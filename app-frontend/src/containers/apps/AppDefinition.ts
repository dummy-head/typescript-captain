//COPIED FROM BACKEND CODE
interface IHashMapGeneric<T> {
    [id: string]: T
}

 type IAllAppDefinitions = IHashMapGeneric<IAppDef>;

interface IAppEnvVar {
  key: string;
  value: string;
}

interface IAppVolume {
  containerPath: string;
  volumeName?: string;
  hostPath?: string;
  type?: "volume" | "bind";

  mode?: string;
}

interface IAppPort {
  containerPort: number;
  hostPort: number;
  protocol?: "udp" | "tcp";

  publishMode?: "ingress" | "host";
}

interface RepoInfo {
  repo: string;
  branch: string;
  user: string;
  password: string;
}

interface RepoInfoEncrypted {
  repo: string;
  branch: string;
  user: string;
  passwordEncrypted: string;
}

interface IAppVersion {
  version: number;
  deployedImageName?: string; // empty if the deploy is not completed
  timeStamp: string;
  gitHash: string | undefined; // TODO make sure we are capturing the right git hash
}

interface IAppCustomDomain {
  publicDomain: string;
  hasSsl: boolean;
}

interface IAppDefinitionBase {
  deployedVersion: number;
  notExposeAsWebApp: boolean;
  hasPersistentData: boolean;
  hasDefaultSubDomainSsl: boolean;

  forceSsl: boolean;
  nodeId?: string;
  instanceCount: number;
  preDeployFunction?: string;
  customNginxConfig?: string;
  networks: string[];
  customDomain: IAppCustomDomain[];

  ports: IAppPort[];
  volumes: IAppVolume[];
  envVars: IAppEnvVar[];

  versions: IAppVersion[];
}

export interface IAppDef extends IAppDefinitionBase {
  appPushWebhook?: {
    tokenVersion: string;
    repoInfo: RepoInfo;
    pushWebhookToken: string;
  };
  appName?: string;
  isAppBuilding?: boolean;
}

interface IAppDefSaved extends IAppDefinitionBase {
  appPushWebhook:
    | {
        tokenVersion: string;
        repoInfo: RepoInfoEncrypted;
        pushWebhookToken: string;
      }
    | undefined;
}
