type IAllAppDefinitions = IHashMapGeneric<IAppDef>

interface IAppEnvVar {
    key: string
    value: string
}

interface IAppVolume {
    containerPath: string
    volumeName?: string
    hostPath?: string
    type?: 'volume' | 'bind'

    mode?: string
}

interface IAppPort {
    containerPort: number
    hostPort: number
    protocol?: 'udp' | 'tcp'

    publishMode?: 'ingress' | 'host'
}

interface RepoInfo {
    repo: string
    branch: string
    user: string
    password: string
}

interface RepoInfoEncrypted {
    repo: string
    branch: string
    user: string
    passwordEncrypted: string
}

abstract class IAppDefinitionBase {
    public deployedVersion: number
    public notExposeAsWebApp: boolean
    public hasPersistentData: boolean
    public hasDefaultSubDomainSsl: boolean

    public forceSsl: boolean
    public nodeId?: string
    public instanceCount: number
    public preDeployFunction?: string
    public customNginxConfig?: string
    public networks: string[]
    public customDomain: {
        publicDomain: string
        hasSsl: boolean
    }[]

    public ports: IAppPort[]

    public volumes: IAppVolume[]
    public envVars: IAppEnvVar[]

    public versions: {
        version: number
        imageName?: string // empty if the deploy is not completed
        timeStamp: string
        /// imageName: string,
        gitHash: string | undefined
    }[]
}

class IAppDef extends IAppDefinitionBase {
    public appPushWebhook?: {
        tokenVersion: string
        repoInfo: RepoInfo
        pushWebhookToken: string
    }
    public appName?: string
    public isAppBuilding?: boolean
}

class IAppDefSaved extends IAppDefinitionBase {
    public appPushWebhook:
        | {
              tokenVersion: string
              repoInfo: RepoInfoEncrypted
              pushWebhookToken: string
          }
        | undefined
}
