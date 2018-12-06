import CaptainConstants = require('../utils/CaptainConstants')
import Logger = require('../utils/Logger')
import EnvVars = require('../utils/EnvVars')
import fs = require('fs-extra')
import uuid = require('uuid/v4')
import ApiStatusCodes = require('../api/ApiStatusCodes')
import bcrypt = require('bcryptjs')
import DockerApi = require('../docker/DockerApi')
import DataStore = require('../datastore/DataStore')
import CertbotManager = require('../user/CertbotManager')
import LoadBalancerManager = require('../user/LoadBalancerManager')
import CaptainManager = require('../user/CaptainManager')

class DockerRegistry {
    constructor(
        private dockerApi: DockerApi,
        private dataStore: DataStore,
        private certbotManager: CertbotManager,
        private loadBalancerManager: LoadBalancerManager,
        private captainManager: CaptainManager
    ) {
        //
    }

    enableRegistrySsl() {
        const self = this

        return Promise.resolve()
            .then(function() {
                return self.dataStore.getHasRootSsl()
            })
            .then(function(rootHasSsl) {
                if (!rootHasSsl) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.ILLEGAL_OPERATION,
                        'Root must have SSL before enabling ssl for docker registry.'
                    )
                }

                return self.certbotManager.enableSsl(
                    CaptainConstants.registrySubDomain +
                        '.' +
                        self.dataStore.getRootDomain()
                )
            })
            .then(function() {
                return self.dataStore.setHasRegistrySsl(true)
            })
            .then(function() {
                return self.loadBalancerManager.rePopulateNginxConfigFile(
                    self.dataStore
                )
            })
            .then(function() {
                return self.loadBalancerManager.sendReloadSignal()
            })
    }

    getLocalRegistryDomainAndPort() {
        const self = this

        return (
            CaptainConstants.registrySubDomain +
            '.' +
            self.dataStore.getRootDomain() +
            ':' +
            CaptainConstants.configs.registrySubDomainPort
        )
    }

    ensureServiceRemoved() {
        const dockerApi = this.dockerApi

        return Promise.resolve() //
            .then(function() {
                return dockerApi.isServiceRunningByName(
                    CaptainConstants.registryServiceName
                )
            })
            .then(function(isRunning) {
                if (!isRunning) return

                return dockerApi.removeServiceByName(
                    CaptainConstants.registryServiceName
                )
            })
    }

    ensureDockerRegistryRunningOnThisNode(password: string) {
        const dockerApi = this.dockerApi
        const dataStore = this.dataStore

        const myNodeId = this.captainManager.getMyNodeId()

        function createRegistryServiceOnNode() {
            return dockerApi.createServiceOnNodeId(
                CaptainConstants.registryImageName,
                CaptainConstants.registryServiceName,
                [
                    {
                        protocol: 'tcp',
                        containerPort: 5000,
                        hostPort: CaptainConstants.configs.registrySubDomainPort,
                    },
                ],
                myNodeId,
                [
                    {
                        containerPath: '/cert-files',
                        hostPath: CaptainConstants.letsEncryptEtcPath,
                    },
                    {
                        containerPath: '/var/lib/registry',
                        hostPath: CaptainConstants.registryPathOnHost,
                    },
                    {
                        containerPath: '/etc/auth',
                        hostPath: CaptainConstants.registryAuthPathOnHost,
                    },
                ],
                [
                    {
                        key: 'REGISTRY_HTTP_TLS_CERTIFICATE',
                        value:
                            '/cert-files/live/' +
                            CaptainConstants.registrySubDomain +
                            '.' +
                            dataStore.getRootDomain() +
                            '/fullchain.pem',
                    },
                    {
                        key: 'REGISTRY_HTTP_TLS_KEY',
                        value:
                            '/cert-files/live/' +
                            CaptainConstants.registrySubDomain +
                            '.' +
                            dataStore.getRootDomain() +
                            '/privkey.pem',
                    },
                    {
                        key: 'REGISTRY_AUTH',
                        value: 'htpasswd',
                    },
                    {
                        key: 'REGISTRY_AUTH_HTPASSWD_REALM',
                        value: 'Registry Realm',
                    },
                    {
                        key: 'REGISTRY_AUTH_HTPASSWD_PATH',
                        value: '/etc/auth',
                    },
                ],
                undefined
            )
        }

        return Promise.resolve()
            .then(function() {
                const authContent =
                    CaptainConstants.captainRegistryUsername +
                    ':' +
                    bcrypt.hashSync(password, bcrypt.genSaltSync(5))

                return fs.outputFile(
                    CaptainConstants.registryAuthPathOnHost,
                    authContent
                )
            })
            .then(function() {
                return dockerApi.isServiceRunningByName(
                    CaptainConstants.registryServiceName
                )
            })
            .then(function(isRunning) {
                if (isRunning) {
                    Logger.d('Captain Registry is already running.. ')

                    return dockerApi.getNodeIdByServiceName(
                        CaptainConstants.registryServiceName,
                        0
                    )
                } else {
                    Logger.d(
                        'No Captain Registry service is running. Creating one...'
                    )

                    return createRegistryServiceOnNode().then(function() {
                        return myNodeId
                    })
                }
            })
            .then(function(nodeId) {
                if (nodeId !== myNodeId) {
                    Logger.d(
                        'Captain Registry is running on a different node. Removing...'
                    )

                    return dockerApi
                        .removeServiceByName(
                            CaptainConstants.registryServiceName
                        )
                        .then(function() {
                            Logger.d('Creating Registry on this node...')

                            return createRegistryServiceOnNode().then(
                                function() {
                                    return true
                                }
                            )
                        })
                } else {
                    return true
                }
            })
    }
}

export = DockerRegistry
