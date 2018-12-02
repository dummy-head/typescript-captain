"use strict";
/**
 * Created by kasra on 27/06/17.
 */
const Configstore = require("configstore");
const uuid = require("uuid/v4");
const fs = require("fs-extra");
const ApiStatusCodes = require("../api/ApiStatusCodes");
const CaptainConstants = require("../utils/CaptainConstants");
const Encryptor = require("../utils/Encryptor");
const AppsDataStore = require("./AppsDataStore");
const NAMESPACE = 'namespace';
const HASHED_PASSWORD = 'hashedPassword';
const CUSTOM_DOMAIN = 'customDomain';
const HAS_ROOT_SSL = 'hasRootSsl';
const FORCE_ROOT_SSL = 'forceRootSsl';
const HAS_REGISTRY_SSL = 'hasRegistrySsl';
const EMAIL_ADDRESS = 'emailAddress';
const DOCKER_REGISTRIES = 'dockerRegistries';
const DEFAULT_DOCKER_REGISTRY_ID = 'defaultDockerRegId';
const NET_DATA_INFO = 'netDataInfo';
const NGINX_BASE_CONFIG = 'NGINX_BASE_CONFIG';
const NGINX_CAPTAIN_CONFIG = 'NGINX_CAPTAIN_CONFIG';
const DEFAULT_CAPTAIN_ROOT_DOMAIN = 'captain.localhost';
const DEFAULT_NGINX_BASE_CONFIG = fs
    .readFileSync(__dirname + '/../../template/base-nginx-conf.ejs')
    .toString();
const DEFAULT_NGINX_CAPTAIN_CONFIG = fs
    .readFileSync(__dirname + '/../../template/root-nginx-conf.ejs')
    .toString();
const DEFAULT_NGINX_CONFIG_FOR_APP = fs
    .readFileSync(__dirname + '/../../template/server-block-conf.ejs')
    .toString();
class DataStore {
    constructor(namespace) {
        const data = new Configstore('captain-store', {});
        data.path = CaptainConstants.captainRootDirectory + '/config.conf';
        this.data = data;
        this.namespace = namespace;
        this.data.set(NAMESPACE, namespace);
        this.appsDataStore = new AppsDataStore(this.data, namespace);
    }
    setEncryptionSalt(salt) {
        this.encryptor = new Encryptor.CaptainEncryptor(this.namespace + salt);
        this.appsDataStore.setEncryptor(this.encryptor);
    }
    getNameSpace() {
        return this.data.get(NAMESPACE);
    }
    setHashedPassword(newHashedPassword) {
        const self = this;
        return Promise.resolve().then(function () {
            return self.data.set(HASHED_PASSWORD, newHashedPassword);
        });
    }
    getHashedPassword() {
        const self = this;
        return Promise.resolve().then(function () {
            return self.data.get(HASHED_PASSWORD);
        });
    }
    /*
            "smtp": {
                "to": "",
                "hostname": "",
                "server": "",
                "port": "",
                "allowNonTls": false,
                "password": "",
                "username": ""
            },
            "slack": {
                "hook": "",
                "channel": ""
            },
            "telegram": {
                "botToken": "",
                "chatId": ""
            },
            "pushBullet": {
                "fallbackEmail": "",
                "apiToken": ""
            }
     */
    getNetDataInfo() {
        const self = this;
        return Promise.resolve().then(function () {
            const netDataInfo = self.data.get(NET_DATA_INFO) || {};
            netDataInfo.isEnabled = netDataInfo.isEnabled || false;
            netDataInfo.data = netDataInfo.data || {};
            return netDataInfo;
        });
    }
    setNetDataInfo(netDataInfo) {
        const self = this;
        return Promise.resolve().then(function () {
            return self.data.set(NET_DATA_INFO, netDataInfo);
        });
    }
    //TODO lookup usage of this method
    getImageNameAndTag(appName, version) {
        let versionStr = '' + version;
        if (version === 0) {
            versionStr = '0';
        }
        return (this.getImageNameBase(appName) +
            appName +
            (versionStr ? ':' + versionStr : ''));
    }
    getImageNameBase(appName) {
        return 'img-' + this.getNameSpace() + '--' + appName;
    }
    getRootDomain() {
        return this.data.get(CUSTOM_DOMAIN) || DEFAULT_CAPTAIN_ROOT_DOMAIN;
    }
    hasCustomDomain() {
        return !!this.data.get(CUSTOM_DOMAIN);
    }
    getServerList() {
        const self = this;
        let hasRootSsl;
        let rootDomain;
        return Promise.resolve()
            .then(function () {
            return self.getHasRootSsl();
        })
            .then(function (val) {
            hasRootSsl = val;
            return self.getRootDomain();
        })
            .then(function (val) {
            rootDomain = val;
        })
            .then(function () {
            return self.getDefaultAppNginxConfig();
        })
            .then(function (defaultAppNginxConfig) {
            return self
                .getAppsDataStore()
                .getAppsServerConfig(defaultAppNginxConfig, hasRootSsl, rootDomain);
        });
    }
    getAppsDataStore() {
        return this.appsDataStore;
    }
    getDefaultPushRegistryId() {
        const self = this;
        return Promise.resolve().then(function () {
            return self.data.get(DEFAULT_DOCKER_REGISTRY_ID);
        });
    }
    setDefaultPushRegistryId(registryId) {
        const self = this;
        return Promise.resolve()
            .then(function () {
            return self.getAllRegistries();
        })
            .then(function (registries) {
            let found = false;
            for (let i = 0; i < registries.length; i++) {
                const registry = registries[i];
                if (registry.id === registryId) {
                    found = true;
                }
            }
            // registryId can be NULL/Empty, meaning that no registry will be the default push registry
            if (!found && !!registryId) {
                throw ApiStatusCodes.createError(ApiStatusCodes.NOT_FOUND, 'Registry not found');
            }
            self.data.set(DEFAULT_DOCKER_REGISTRY_ID, registryId);
        });
    }
    deleteRegistry(registryId) {
        const self = this;
        return Promise.resolve()
            .then(function () {
            if (!registryId)
                throw new Error('Empty registry id to delete!');
            return self.getAllRegistries();
        })
            .then(function (registries) {
            const newReg = [];
            for (let i = 0; i < registries.length; i++) {
                const registry = registries[i];
                if (registry.id !== registryId) {
                    newReg.push(registry);
                }
            }
            if (newReg.length === registries.length) {
                throw ApiStatusCodes.createError(ApiStatusCodes.NOT_FOUND, 'Registry not found');
            }
            self.saveAllRegistries(newReg);
        });
    }
    getAllRegistries() {
        const self = this;
        return Promise.resolve()
            .then(function () {
            return self.data.get(DOCKER_REGISTRIES) || [];
        })
            .then(function (registries) {
            const unencryptedList = [];
            for (let i = 0; i < registries.length; i++) {
                const element = registries[i];
                unencryptedList.push({
                    id: element.id,
                    registryDomain: element.registryDomain,
                    registryImagePrefix: element.registryImagePrefix,
                    registryUser: element.registryUser,
                    registryPassword: self.encryptor.decrypt(element.registryPasswordEncrypted),
                    registryType: element.registryType,
                });
            }
            return unencryptedList;
        });
    }
    updateRegistry(id, registryUser, registryPassword, registryDomain, registryImagePrefix, registryType) {
        const self = this;
        return Promise.resolve()
            .then(function () {
            if (!id ||
                !registryUser ||
                !registryPassword ||
                !registryDomain ||
                !registryType) {
                throw ApiStatusCodes.createError(ApiStatusCodes.ILLEGAL_PARAMETER, 'User, password and domain are required.');
            }
            return self.getAllRegistries();
        })
            .then(function (registries) {
            let found = false;
            for (let idx = 0; idx < registries.length; idx++) {
                const element = registries[idx];
                if (element.id === id) {
                    element.registryUser = registryUser;
                    element.registryPassword = registryPassword;
                    element.registryDomain = registryDomain;
                    element.registryImagePrefix = registryImagePrefix;
                    element.registryType = registryType;
                    found = true;
                }
            }
            if (!found)
                throw ApiStatusCodes.createError(ApiStatusCodes.NOT_FOUND, 'Registry ID not found');
            registries.push({
                id,
                registryUser,
                registryPassword,
                registryDomain,
                registryImagePrefix,
                registryType,
            });
            return self.saveAllRegistries(registries);
        });
    }
    addRegistryToDb(registryUser, registryPassword, registryDomain, registryImagePrefix, registryType) {
        const self = this;
        return Promise.resolve()
            .then(function () {
            if (!registryUser ||
                !registryPassword ||
                !registryDomain ||
                !registryType) {
                throw ApiStatusCodes.createError(ApiStatusCodes.ILLEGAL_PARAMETER, 'User, password and domain are required.');
            }
            return self.getAllRegistries();
        })
            .then(function (registries) {
            let id = uuid();
            let isAlreadyTaken = true;
            while (isAlreadyTaken) {
                id = uuid();
                isAlreadyTaken = false;
                for (let i = 0; i < registries.length; i++) {
                    if (registries[i].id === id) {
                        isAlreadyTaken = true;
                        break;
                    }
                }
            }
            registries.push({
                id,
                registryUser,
                registryPassword,
                registryDomain,
                registryImagePrefix,
                registryType,
            });
            return self.saveAllRegistries(registries);
        });
    }
    saveAllRegistries(registries) {
        const self = this;
        return Promise.resolve() //
            .then(function () {
            const encryptedList = [];
            for (let i = 0; i < registries.length; i++) {
                const element = registries[i];
                encryptedList.push({
                    id: element.id,
                    registryDomain: element.registryDomain,
                    registryImagePrefix: element.registryImagePrefix,
                    registryUser: element.registryUser,
                    registryPasswordEncrypted: self.encryptor.encrypt(element.registryPassword),
                    registryType: element.registryType,
                });
            }
            self.data.set(DOCKER_REGISTRIES, encryptedList);
        });
    }
    setUserEmailAddress(emailAddress) {
        const self = this;
        return new Promise(function (resolve, reject) {
            self.data.set(EMAIL_ADDRESS, emailAddress);
            resolve();
        });
    }
    getUserEmailAddress() {
        const self = this;
        return new Promise(function (resolve, reject) {
            resolve(self.data.get(EMAIL_ADDRESS));
        });
    }
    setHasRootSsl(hasRootSsl) {
        const self = this;
        return new Promise(function (resolve, reject) {
            self.data.set(HAS_ROOT_SSL, hasRootSsl);
            resolve();
        });
    }
    setForceSsl(forceSsl) {
        const self = this;
        return new Promise(function (resolve, reject) {
            self.data.set(FORCE_ROOT_SSL, forceSsl);
            resolve();
        });
    }
    getForceSsl() {
        const self = this;
        return new Promise(function (resolve, reject) {
            resolve(self.data.get(FORCE_ROOT_SSL));
        });
    }
    setHasRegistrySsl(hasRegistrySsl) {
        const self = this;
        return new Promise(function (resolve, reject) {
            self.data.set(HAS_REGISTRY_SSL, hasRegistrySsl);
            resolve();
        });
    }
    getDefaultAppNginxConfig() {
        const self = this;
        return Promise.resolve().then(function () {
            return DEFAULT_NGINX_CONFIG_FOR_APP;
        });
    }
    getNginxConfig() {
        const self = this;
        return Promise.resolve().then(function () {
            return {
                baseConfig: {
                    byDefault: DEFAULT_NGINX_BASE_CONFIG,
                    customValue: self.data.get(NGINX_BASE_CONFIG),
                },
                captainConfig: {
                    byDefault: DEFAULT_NGINX_CAPTAIN_CONFIG,
                    customValue: self.data.get(NGINX_CAPTAIN_CONFIG),
                },
            };
        });
    }
    setNginxConfig(baseConfig, captainConfig) {
        const self = this;
        return Promise.resolve().then(function () {
            self.data.set(NGINX_BASE_CONFIG, baseConfig);
            self.data.set(NGINX_CAPTAIN_CONFIG, captainConfig);
        });
    }
    getHasRootSsl() {
        const self = this;
        return new Promise(function (resolve, reject) {
            resolve(self.data.get(HAS_ROOT_SSL));
        });
    }
    getHasRegistrySsl() {
        const self = this;
        return new Promise(function (resolve, reject) {
            resolve(!!self.data.get(HAS_REGISTRY_SSL));
        });
    }
    setCustomDomain(customDomain) {
        const self = this;
        return new Promise(function (resolve, reject) {
            self.data.set(CUSTOM_DOMAIN, customDomain);
            resolve();
        });
    }
}
module.exports = DataStore;
//# sourceMappingURL=DataStore.js.map