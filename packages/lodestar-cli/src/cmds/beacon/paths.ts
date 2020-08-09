import {IGlobalArgs} from "../../options";
import {getGlobalPaths} from "../../paths/global";
import {joinIfRelative} from "../../util";

export type IBeaconPaths = {
  beaconDir: string;
  peerStoreDir: string;
  dbDir: string;
  configFile: string;
  peerIdFile: string;
  enrFile: string;
  logFile?: string;
};

/**
 * Defines the path structure of the account files
 *
 * ```bash
 * $rootDir
 * └── $beaconDir
 *     ├── beacon.config.json
 *     ├── peer-id.json
 *     ├── enr.json
 *     └── chain-db
 * ```
 */
// Using Pick<IGlobalArgs, "rootDir"> make changes in IGlobalArgs throw a type error here
export function getBeaconPaths(options: Partial<IBeaconPaths> & Pick<IGlobalArgs, "rootDir">): IBeaconPaths {
  const globalPaths = getGlobalPaths(options);
  const beaconDir = globalPaths.rootDir;
  const dbDir = joinIfRelative(beaconDir, options.dbDir || "chain-db");
  const peerStoreDir = joinIfRelative(beaconDir, options.dbDir || "peerstore");
  const configFile = joinIfRelative(beaconDir, options.configFile || "beacon.config.json");
  const peerIdFile = joinIfRelative(beaconDir, options.peerIdFile || "peer-id.json");
  const enrFile = joinIfRelative(beaconDir, options.enrFile || "enr.json");
  const logFile = options.logFile && joinIfRelative(beaconDir, options.logFile);
  return {
    beaconDir,
    dbDir,
    configFile,
    peerStoreDir,
    peerIdFile,
    enrFile,
    logFile
  };
}

/**
 * Constructs representations of the path structure to show in command's description
 */
export const defaultBeaconPaths = getBeaconPaths({rootDir: "$rootDir"});
