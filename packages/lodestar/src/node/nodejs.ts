/**
 * @module node
 */

import deepmerge from "deepmerge";
import {IBeaconConfig} from "../config";
import {BeaconDB, LevelDbController} from "../db";
import {EthersEth1Notifier, IEth1Notifier} from "../eth1";
import {INetwork, Libp2pNetwork, NodejsNode} from "../network";
import defaultConf, {IBeaconNodeOptions} from "./options";
import {isPlainObject} from "../util/objects";
import {Sync} from "../sync";
import {BeaconChain, IBeaconChain} from "../chain";
import {OpPool} from "../opPool";
import {createPeerId, initializePeerInfo} from "../network/libp2p/util";
import {ILogger, WinstonLogger} from "../logger";
import {ReputationStore} from "../sync/reputation";
import {JSONRPC, WSServer} from "../rpc";
import {SyncRpc} from "../network/libp2p/syncRpc";
import {Module} from "../logger/abstract";

export interface Service {
  start(): Promise<void>;

  stop(): Promise<void>;
}

/**
 * Beacon Node configured for desktop (non-browser) use
 */
export class BeaconNode {
  public conf: IBeaconNodeOptions;
  public config: IBeaconConfig;
  public db: BeaconDB;
  public eth1: IEth1Notifier;
  public network: INetwork;
  public chain: IBeaconChain;
  public opPool: OpPool;
  public rpc: Service;
  public sync: Sync;
  public reps: ReputationStore;
  private logger: ILogger;

  public constructor(opts: Partial<IBeaconNodeOptions>, {config, logger}: {config: IBeaconConfig; logger?: ILogger}) {
    this.conf = deepmerge(
      defaultConf,
      opts,
      {
        //clone doesn't work very vell on classes like ethers.Provider
        isMergeableObject: isPlainObject
      }
    );
    this.config = config;
    this.logger = logger || new WinstonLogger();
    this.reps = new ReputationStore();
    this.db = new BeaconDB({
      config,
      controller: new LevelDbController(
        {
          ...this.conf.db,
          loggingLevel: this.conf.loggingOptions.get(Module.DATABASE),
        },
        {}),
    });
    // initialize for network type
    const libp2p = createPeerId()
      .then((peerId) => initializePeerInfo(peerId, this.conf.network.multiaddrs))
      .then((peerInfo) => new NodejsNode({peerInfo}));
    const rpc = new SyncRpc({
      ...this.conf.sync,
      loggingLevel: this.conf.loggingOptions.get(Module.NETWORK),
    }, {
      config,
      db: this.db,
      chain: this.chain,
      network: this.network,
      reps: this.reps,
    });
    this.network = new Libp2pNetwork({
      ...this.conf.network,
      loggingLevel: this.conf.loggingOptions.get(Module.NETWORK),
    }, {
      config,
      libp2p: libp2p,
    });
    this.eth1 = new EthersEth1Notifier(
      {
        ...this.conf.eth1,
        loggingLevel: this.conf.loggingOptions.get(Module.ETH1),
      }, {
        config,
      });
    this.opPool = new OpPool(this.conf.opPool, {
      eth1: this.eth1,
      db: this.db
    });
    this.chain = new BeaconChain(
      {
        ...this.conf.chain,
        loggingLevel: this.conf.loggingOptions.get(Module.CHAIN),
      }, {
        config,
        db: this.db,
        eth1: this.eth1,
        opPool: this.opPool
      });
    this.sync = new Sync({
      ...this.conf.sync,
      loggingLevel: this.conf.loggingOptions.get(Module.SYNC),
    }, {
      config,
      db: this.db,
      eth1: this.eth1,
      chain: this.chain,
      opPool: this.opPool,
      network: this.network,
      reps: this.reps,
      rpc,
    });
    //TODO: needs to be moved to Rpc class and initialized from opts
    this.rpc = new JSONRPC(this.conf.api, {
      transports: [new WSServer(this.conf.api.transports[0])],
      apis: this.conf.api.apis.map((Api) => {
        return new Api({}, {config, chain: this.chain, db: this.db, eth1: this.eth1});
      })
    });

  }

  public async start(): Promise<void> {
    this.logger.info('Starting eth2 beacon node - LODESTAR!');
    await this.db.start();
    await this.network.start();
    await this.eth1.start();
    await this.chain.start();
    await this.opPool.start();
    await this.sync.start();
    await this.rpc.start();
  }

  public async stop(): Promise<void> {
    await this.rpc.stop();
    await this.sync.stop();
    await this.opPool.stop();

    await this.chain.stop();
    await this.eth1.stop();
    await this.network.stop();
    await this.db.stop();
  }
}

export default BeaconNode;
