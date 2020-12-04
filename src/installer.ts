import * as core from "@actions/core";
import { exec } from "@actions/exec";
import * as tc from "@actions/tool-cache";
import * as cache from "@actions/cache";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as util from "util";

const osPlat = os.platform();
const osArch = os.arch();
const osRelease = os.release();

function getCacheKey(version: string, repository: string) {
  return `${osPlat}-${osArch}-${osRelease}-${version}-${repository}`
}

function getOpamFileName(version: string) {
  const platform = osPlat === "darwin" ? "macos" : osPlat;
  const arch = osArch === "x64" ? "x86_64" : "i686";
  const filename = util.format("opam-%s-%s-%s", version, arch, platform);
  return filename;
}

function getOpamDownloadUrl(version: string, filename: string) {
  return util.format(
    "https://github.com/ocaml/opam/releases/download/%s/%s",
    version,
    filename
  );
}

async function acquireOpamWindows(version: string, customRepository: string) {
  const repository =
    customRepository ||
    "https://github.com/fdopen/opam-repository-mingw.git#opam2";

  let downloadPath;
  try {
    downloadPath = await tc.downloadTool("https://cygwin.com/setup-x86_64.exe");
  } catch (error) {
    core.debug(error);
    throw `Failed to download cygwin: ${error}`;
  }
  const toolPath = await tc.cacheFile(
    downloadPath,
    "setup-x86_64.exe",
    "cygwin",
    "1.0"
  );
  await exec(path.join(__dirname, "install-ocaml-windows.cmd"), [
    __dirname,
    toolPath,
    version,
    repository,
  ]);
  core.addPath("c:\\cygwin\\bin");
  core.addPath("c:\\cygwin\\wrapperbin");
}

async function acquireOpamLinux(version: string, customRepository: string) {
  const opamVersion = "2.0.7";
  const fileName = getOpamFileName(opamVersion);
  const downloadUrl = getOpamDownloadUrl(opamVersion, fileName);
  const repository =
    customRepository || "https://github.com/ocaml/opam-repository.git";

  let downloadPath;
  try {
    downloadPath = await tc.downloadTool(downloadUrl);
  } catch (error) {
    core.debug(error);
    throw `Failed to download version ${opamVersion}: ${error}`;
  }
  fs.chmodSync(downloadPath, "755");
  const toolPath: string = await tc.cacheFile(
    downloadPath,
    "opam",
    "opam",
    opamVersion
  );
  core.addPath(toolPath);
  await exec(
    "sudo apt-get -y install bubblewrap ocaml-native-compilers ocaml-compiler-libs musl-tools"
  );

  const cachedPath = ["~/.opam"];
  const key = getCacheKey(version, repository);

  const cacheKey = await cache.restoreCache(cachedPath, key);

  core.warning(`Cache miss: for entry ${key} (${cacheKey}).`);

  if (cacheKey === undefined) {
    await exec(`"${toolPath}/opam"`, ["init", "-yav", repository]);
    await exec(path.join(__dirname, "install-ocaml-unix.sh"), [version]);
    await exec(`"${toolPath}/opam"`, ["install", "-y", "depext"]);

    try {
      await cache.saveCache(cachedPath, key)
    } catch (err ) {
      if (err instanceof cache.ReserveCacheError) {
        core.info(`Cache entry ${key} has already been created by another worfklow`);
      } else {
        throw err
      }
    }
  } else {
    core.info(`Restoring cache from key ${key}`)
    await exec(`"${toolPath}/opam"`, ["update", "-y"])
    await exec(`"${toolPath}/opam"`, ["upgrade", "-y"])
  }
}

async function acquireOpamDarwin(version: string, customRepository: string) {
  const repository =
    customRepository || "https://github.com/ocaml/opam-repository.git";

  await exec("brew", ["install", "opam"]);
  await exec("opam", ["init", "-yav", repository]);
  await exec(path.join(__dirname, "install-ocaml-unix.sh"), [version]);
  await exec("opam", ["install", "-y", "depext"]);
}

export async function getOpam(
  version: string,
  repository: string
): Promise<void> {
  core.exportVariable("OPAMYES", "1");
  if (osPlat === "win32") return acquireOpamWindows(version, repository);
  else if (osPlat === "darwin") return acquireOpamDarwin(version, repository);
  else if (osPlat === "linux") return acquireOpamLinux(version, repository);
}
