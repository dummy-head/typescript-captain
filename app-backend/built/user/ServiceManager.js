"use strict";
const CaptainConstants = require("../utils/CaptainConstants");
const Logger = require("../utils/Logger");
const fs = require("fs-extra");
const tar = require("tar");
const path = require("path");
const CaptainManager = require("./CaptainManager");
const ApiStatusCodes = require("../api/ApiStatusCodes");
const TemplateHelper = require("./TemplateHelper");
const Authenticator = require("./Authenticator");
const GitHelper = require("../utils/GitHelper");
const uuid = require("uuid/v4");
const requireFromString = require("require-from-string");
const BuildLog = require("./BuildLog");
const BUILD_LOG_SIZE = 50;
const SOURCE_FOLDER_NAME = 'src';
const DOCKER_FILE = 'Dockerfile';
const CAPTAIN_DEFINITION_FILE = 'captain-definition';
const PLACEHOLDER_DOCKER_FILE_CONTENT = 'FROM ' +
    CaptainConstants.appPlaceholderImageName +
    '\nCMD [ "npm", "start" ]';
function getRawImageSourceFolder(imageName, newVersionPulled) {
    return (CaptainConstants.captainRawImagesDir +
        '/' +
        imageName +
        '/' +
        newVersionPulled +
        '/' +
        SOURCE_FOLDER_NAME);
}
function getRawImageBaseFolder(imageName, newVersionPulled) {
    return (CaptainConstants.captainRawImagesDir +
        '/' +
        imageName +
        '/' +
        newVersionPulled);
}
function getTarImageBaseFolder(imageName, newVersionPulled) {
    return (CaptainConstants.captainTarImagesDir +
        '/' +
        imageName +
        '/' +
        newVersionPulled);
}
function getCaptainDefinitionTempFolder(serviceName, randomSuffix) {
    return (CaptainConstants.captainDefinitionTempDir +
        '/' +
        serviceName +
        '/' +
        randomSuffix);
}
class ServiceManager {
    constructor(dataStore, dockerApi, loadBalancerManager) {
        this.dataStore = dataStore;
        this.dockerApi = dockerApi;
        this.loadBalancerManager = loadBalancerManager;
        this.activeBuilds = {};
        this.buildLogs = {};
        this.isReady = true;
    }
    isInited() {
        return this.isReady;
    }
    createTarFarFromCaptainContent(captainDefinitionContent, appName, tarDestination) {
        const serviceName = this.dataStore
            .getAppsDataStore()
            .getServiceName(appName);
        let captainDefinitionDirPath = undefined;
        return Promise.resolve()
            .then(function () {
            for (let i = 0; i < 100; i++) {
                const temp = getCaptainDefinitionTempFolder(serviceName, uuid());
                if (!fs.pathExistsSync(temp)) {
                    captainDefinitionDirPath = temp;
                    break;
                }
            }
            if (!captainDefinitionDirPath) {
                throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'Cannot create a temp file! Something is seriously wrong with the temp folder');
            }
            return fs.outputFile(captainDefinitionDirPath + '/' + CAPTAIN_DEFINITION_FILE, captainDefinitionContent);
        })
            .then(function () {
            return tar.c({
                file: tarDestination,
                cwd: captainDefinitionDirPath,
            }, [CAPTAIN_DEFINITION_FILE]);
        })
            .then(function () {
            if (!captainDefinitionDirPath) {
                throw new Error('captainDefinitionDirPath is NULL');
            }
            return fs.remove(captainDefinitionDirPath);
        });
    }
    /**
     *
     * @param appName
     * @param source
     *                 pathToSrcTarballFile
     *                   OR
     *                 repoInfo : {repo, user, password, branch}
     *                   OR
     *                 undefined
     * @param gitHash
     * @returns {Promise<void>}
     */
    createImage(appName, source, gitHash) {
        Logger.d('Creating image for: ' + appName);
        const self = this;
        const imageName = this.dataStore.getImageName(CaptainManager.get().getDockerAuthObject(), appName, undefined);
        const dockerApi = this.dockerApi;
        const dataStore = this.dataStore;
        let newVersion;
        let rawImageSourceFolder;
        let rawImageBaseFolder;
        let tarImageBaseFolder;
        let tarballFilePath;
        let dockerFilePath;
        this.activeBuilds[appName] = true;
        this.buildLogs[appName] =
            this.buildLogs[appName] || new BuildLog(BUILD_LOG_SIZE);
        this.buildLogs[appName].clear();
        this.buildLogs[appName].log('------------------------- ' + new Date());
        this.buildLogs[appName].log('Build started for ' + appName);
        return Promise.resolve()
            .then(function () {
            return dataStore.getAppsDataStore().getNewVersion(appName);
        })
            .then(function (newVersionPulled) {
            newVersion = newVersionPulled;
            rawImageSourceFolder = getRawImageSourceFolder(imageName, newVersionPulled);
            rawImageBaseFolder = getRawImageBaseFolder(imageName, newVersionPulled);
            dockerFilePath = rawImageBaseFolder + '/' + DOCKER_FILE;
            tarImageBaseFolder = getTarImageBaseFolder(imageName, newVersionPulled);
            tarballFilePath = tarImageBaseFolder + '/image.tar';
            return fs.ensureDir(rawImageSourceFolder).then(function () {
                return rawImageSourceFolder;
            });
        })
            .then(function (rawImageSourceFolder) {
            let promiseToFetchDirectory;
            if (source &&
                source
                    .pathToSrcTarballFile) {
                promiseToFetchDirectory = tar
                    .x({
                    file: source
                        .pathToSrcTarballFile,
                    cwd: rawImageSourceFolder,
                })
                    .then(function () {
                    return gitHash;
                });
            }
            else if (source &&
                source.repoInfo) {
                const repoInfo = source
                    .repoInfo;
                promiseToFetchDirectory = GitHelper.clone(repoInfo.user, repoInfo.password, repoInfo.repo, repoInfo.branch, rawImageSourceFolder).then(function () {
                    return GitHelper.getLastHash(rawImageSourceFolder);
                });
            }
            else {
                return PLACEHOLDER_DOCKER_FILE_CONTENT;
            }
            return promiseToFetchDirectory
                .then(function (gitHashToSave) {
                return dataStore
                    .getAppsDataStore()
                    .setGitHash(appName, newVersion, gitHashToSave);
            })
                .then(function () {
                return fs.pathExists(rawImageSourceFolder + '/' + CAPTAIN_DEFINITION_FILE);
            })
                .then(function (exists) {
                if (!exists) {
                    Logger.d('Captain Definition does not exist in the base tar. Looking inside...');
                    // check if there is only one child
                    // check if it's a directory
                    // check if captain definition exists in it
                    // rename rawImageSourceFolder to rawImageSourceFolder+'.bak'
                    // move the child directory out to base and rename it to rawImageSourceFolder
                    // read captain definition from the folder and return it.
                    let directoryInside;
                    return new Promise(function (resolve, reject) {
                        fs.readdir(rawImageSourceFolder, function (err, files) {
                            if (err) {
                                reject(err);
                                return;
                            }
                            if (files.length !== 1 ||
                                !fs
                                    .statSync(path.join(rawImageSourceFolder, files[0]))
                                    .isDirectory()) {
                                reject(ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'Captain Definition file does not exist!'));
                                return;
                            }
                            resolve(files[0]);
                        });
                    })
                        .then(function (directory) {
                        directoryInside = directory;
                        return fs.pathExists(path.join(path.join(rawImageSourceFolder, directoryInside), CAPTAIN_DEFINITION_FILE));
                    })
                        .then(function (captainDefinitionExists) {
                        if (!captainDefinitionExists) {
                            throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'Captain Definition file does not exist!');
                        }
                        const BAK = '.bak';
                        fs.renameSync(rawImageSourceFolder, rawImageSourceFolder + BAK);
                        fs.renameSync(path.join(rawImageSourceFolder + BAK, directoryInside), rawImageSourceFolder);
                    });
                }
            })
                .then(function () {
                return fs.readJson(rawImageSourceFolder + '/' + CAPTAIN_DEFINITION_FILE);
            })
                .then(function (data) {
                if (!data) {
                    throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'Captain Definition File is empty!');
                }
                if (!data.schemaVersion) {
                    throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'Captain Definition version is empty!');
                }
                if (data.schemaVersion === 1) {
                    const templateIdTag = data.templateId;
                    const dockerfileLines = data.dockerfileLines;
                    const hasDockerfileLines = dockerfileLines && dockerfileLines.length > 0;
                    if (hasDockerfileLines && !templateIdTag) {
                        return dockerfileLines.join('\n');
                    }
                    else if (!hasDockerfileLines && templateIdTag) {
                        return TemplateHelper.get().getDockerfileContentFromTemplateTag(templateIdTag);
                    }
                    else {
                        throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'Dockerfile or TemplateId must be present. Both should not be present at the same time');
                    }
                }
                else {
                    throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'Captain Definition version is not supported!');
                }
            });
        })
            .then(function (dockerfileContent) {
            return fs.outputFile(dockerFilePath, dockerfileContent);
        })
            .then(function () {
            return fs.ensureDir(tarImageBaseFolder);
        })
            .then(function () {
            return tar.c({
                file: tarballFilePath,
                cwd: rawImageBaseFolder,
            }, [SOURCE_FOLDER_NAME, DOCKER_FILE]);
        })
            .then(function () {
            return dockerApi
                .buildImageFromDockerFile(imageName, newVersion, tarballFilePath, self.buildLogs[appName])
                .catch(function (error) {
                throw ApiStatusCodes.createError(ApiStatusCodes.BUILD_ERROR, ('' + error).trim());
            });
        })
            .then(function () {
            Logger.d('Cleaning up up the files... ' +
                tarImageBaseFolder +
                '  and  ' +
                rawImageBaseFolder);
            return fs.remove(tarImageBaseFolder);
        })
            .then(function () {
            return fs.remove(rawImageBaseFolder);
        })
            .then(function () {
            const authObj = CaptainManager.get().getDockerAuthObject();
            if (!authObj) {
                Logger.d('No Docker Auth is found. Skipping pushing the image.');
                return Promise.resolve();
            }
            Logger.d('Docker Auth is found. Pushing the image...');
            return dockerApi
                .pushImage(imageName, newVersion, authObj, self.buildLogs[appName])
                .catch(function (error) {
                return new Promise(function (resolve, reject) {
                    Logger.e('PUSH FAILED');
                    Logger.e(error);
                    reject(ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'Push failed: ' + error));
                });
            });
        })
            .then(function () {
            self.activeBuilds[appName] = false;
            return newVersion;
        })
            .catch(function (error) {
            self.activeBuilds[appName] = false;
            return new Promise(function (resolve, reject) {
                reject(error);
            });
        });
    }
    enableCustomDomainSsl(appName, customDomain) {
        const self = this;
        return Promise.resolve()
            .then(function () {
            Logger.d('Verifying Captain owns domain: ' + customDomain);
            return CaptainManager.get().verifyCaptainOwnsDomainOrThrow(customDomain, undefined);
        })
            .then(function () {
            Logger.d('Enabling SSL for: ' + appName + ' on ' + customDomain);
            return self.dataStore
                .getAppsDataStore()
                .verifyCustomDomainBelongsToApp(appName, customDomain);
        })
            .then(function () {
            return CaptainManager.get().requestCertificateForDomain(customDomain);
        })
            .then(function () {
            return self.dataStore
                .getAppsDataStore()
                .enableCustomDomainSsl(appName, customDomain);
        })
            .then(function () {
            return self.reloadLoadBalancer();
        });
    }
    addCustomDomain(appName, customDomain) {
        const self = this;
        return Promise.resolve()
            .then(function () {
            const rootDomain = self.dataStore.getRootDomain();
            const dotRootDomain = '.' + rootDomain;
            if (!customDomain || !/^[a-z0-9\-\.]+$/.test(customDomain)) {
                throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_BAD_NAME, 'Domain name is not accepted. Please use alphanumerical domains such as myapp.google123.ca');
            }
            if (customDomain.length > 80) {
                throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_BAD_NAME, 'Domain name is not accepted. Please use alphanumerical domains less than 80 characters in length.');
            }
            if (customDomain.indexOf('..') >= 0) {
                throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_BAD_NAME, 'Domain name is not accepted. You cannot have two consecutive periods ".." inside a domain name. Please use alphanumerical domains such as myapp.google123.ca');
            }
            if (customDomain.indexOf(dotRootDomain) >= 0 &&
                customDomain.indexOf(dotRootDomain) +
                    dotRootDomain.length ===
                    customDomain.length) {
                throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_BAD_NAME, 'Domain name is not accepted. Custom domain cannot be subdomain of root domain.');
            }
        })
            .then(function () {
            return CaptainManager.get().verifyDomainResolvesToDefaultServerOnHost(customDomain);
        })
            .then(function () {
            Logger.d('Enabling custom domain for: ' + appName);
            return self.dataStore
                .getAppsDataStore()
                .addCustomDomainForApp(appName, customDomain);
        })
            .then(function () {
            return self.reloadLoadBalancer();
        });
    }
    removeCustomDomain(appName, customDomain) {
        const self = this;
        return Promise.resolve()
            .then(function () {
            Logger.d('Removing custom domain for: ' + appName);
            return self.dataStore
                .getAppsDataStore()
                .removeCustomDomainForApp(appName, customDomain);
        })
            .then(function () {
            return self.reloadLoadBalancer();
        });
    }
    enableSslForApp(appName) {
        const self = this;
        let rootDomain;
        return Promise.resolve()
            .then(function () {
            return self.verifyCaptainOwnsGenericSubDomain(appName);
        })
            .then(function () {
            Logger.d('Enabling SSL for: ' + appName);
            return self.dataStore.getRootDomain();
        })
            .then(function (val) {
            rootDomain = val;
            if (!rootDomain) {
                throw new Error('No rootDomain! Cannot verify domain');
            }
        })
            .then(function () {
            // it will ensure that the app exists, otherwise it throws an exception
            return self.dataStore
                .getAppsDataStore()
                .getAppDefinition(appName);
        })
            .then(function () {
            return appName + '.' + rootDomain;
        })
            .then(function (domainName) {
            return CaptainManager.get().requestCertificateForDomain(domainName);
        })
            .then(function () {
            return self.dataStore
                .getAppsDataStore()
                .enableSslForDefaultSubDomain(appName);
        })
            .then(function () {
            return self.reloadLoadBalancer();
        });
    }
    verifyCaptainOwnsGenericSubDomain(appName) {
        const self = this;
        let rootDomain;
        return Promise.resolve()
            .then(function () {
            return self.dataStore.getRootDomain();
        })
            .then(function (val) {
            rootDomain = val;
        })
            .then(function () {
            // it will ensure that the app exists, otherwise it throws an exception
            return self.dataStore
                .getAppsDataStore()
                .getAppDefinition(appName);
        })
            .then(function () {
            return appName + '.' + rootDomain;
        })
            .then(function (domainName) {
            Logger.d('Verifying Captain owns domain: ' + domainName);
            return CaptainManager.get().verifyCaptainOwnsDomainOrThrow(domainName, undefined);
        });
    }
    removeApp(appName) {
        Logger.d('Removing service for: ' + appName);
        const self = this;
        const serviceName = this.dataStore
            .getAppsDataStore()
            .getServiceName(appName);
        const dockerApi = this.dockerApi;
        const dataStore = this.dataStore;
        return Promise.resolve()
            .then(function () {
            Logger.d('Check if service is running: ' + serviceName);
            return dockerApi.isServiceRunningByName(serviceName);
        })
            .then(function (isRunning) {
            if (isRunning) {
                return dockerApi.removeService(serviceName);
            }
            else {
                Logger.w('Cannot delete service... It is not running: ' +
                    serviceName);
                return true;
            }
        })
            .then(function () {
            return dataStore.getAppsDataStore().deleteAppDefinition(appName);
        })
            .then(function () {
            return self.reloadLoadBalancer();
        });
    }
    getUnusedImages(mostRecentLimit) {
        Logger.d('Getting unused images, excluding most recent ones: ' +
            mostRecentLimit);
        const self = this;
        const dockerApi = this.dockerApi;
        const dataStore = this.dataStore;
        let allImages;
        return Promise.resolve()
            .then(function () {
            return dockerApi.getImages();
        })
            .then(function (images) {
            allImages = images;
            return dataStore.getAppsDataStore().getAppDefinitions();
        })
            .then(function (apps) {
            const unusedImages = [];
            for (let i = 0; i < allImages.length; i++) {
                const img = allImages[i];
                let imageInUse = false;
                if (img.RepoTags) {
                    for (let j = 0; j < img.RepoTags.length; j++) {
                        const repoTag = img.RepoTags[j];
                        Object.keys(apps).forEach(function (key, index) {
                            const app = apps[key];
                            const appName = key;
                            for (let k = 0; k < mostRecentLimit + 1; k++) {
                                if (repoTag.indexOf(dataStore.getImageNameWithoutAuthObj(appName, Number(app.deployedVersion) - k)) >= 0) {
                                    imageInUse = true;
                                }
                            }
                        });
                    }
                }
                if (!imageInUse) {
                    unusedImages.push({
                        id: img.Id,
                        description: img.RepoTags && img.RepoTags.length
                            ? img.RepoTags[0]
                            : 'untagged',
                    });
                }
            }
            return unusedImages;
        });
    }
    deleteImages(imageIds) {
        Logger.d('Deleting images...');
        const self = this;
        const dockerApi = this.dockerApi;
        return Promise.resolve().then(function () {
            return dockerApi.deleteImages(imageIds);
        });
    }
    ensureServiceInitedAndUpdated(appName, version) {
        Logger.d('Ensure service inited and Updated for: ' + appName);
        const self = this;
        const serviceName = this.dataStore
            .getAppsDataStore()
            .getServiceName(appName);
        const dockerAuthObject = CaptainManager.get().getDockerAuthObject();
        const imageName = this.dataStore.getImageName(dockerAuthObject, appName, version);
        const dockerApi = this.dockerApi;
        const dataStore = this.dataStore;
        let app;
        return dataStore
            .getAppsDataStore()
            .setDeployedVersion(appName, version)
            .then(function () {
            return dataStore.getAppsDataStore().getAppDefinition(appName);
        })
            .then(function (appFound) {
            app = appFound;
            Logger.d('Check if service is running: ' + serviceName);
            return dockerApi.isServiceRunningByName(serviceName);
        })
            .then(function (isRunning) {
            if (isRunning) {
                Logger.d('Service is already running: ' + serviceName);
                return true;
            }
            else {
                Logger.d('Creating service: ' +
                    serviceName +
                    ' with image: ' +
                    imageName);
                // if we pass in networks here. Almost always it results in a delayed update which causes
                // update errors if they happen right away!
                return dockerApi.createServiceOnNodeId(imageName, serviceName, undefined, undefined, undefined, undefined, undefined);
            }
        })
            .then(function () {
            return self.createPreDeployFunctionIfExist(app);
        })
            .then(function (preDeployFunction) {
            Logger.d('Updating service: ' +
                serviceName +
                ' with image: ' +
                imageName);
            return dockerApi.updateService(serviceName, imageName, app.volumes, app.networks, app.envVars, undefined, dockerAuthObject, Number(app.instanceCount), app.nodeId, dataStore.getNameSpace(), app.ports, app, preDeployFunction);
        })
            .then(function () {
            return new Promise(function (resolve) {
                // Waiting 2 extra seconds for docker DNS to pickup the service name
                setTimeout(resolve, 2000);
            });
        })
            .then(function () {
            return self.reloadLoadBalancer();
        });
    }
    createPreDeployFunctionIfExist(app) {
        let preDeployFunction = app.preDeployFunction;
        if (!preDeployFunction) {
            return undefined;
        }
        /*
        ////////////////////////////////// Expected content of the file //////////////////////////

            const uuid = require('uuid/v4');
            console.log('-------------------------------'+uuid());

            preDeployFunction = function (captainAppObj, dockerUpdateObject) {
                return Promise.resolve()
                        .then(function(){
                            console.log(JSON.stringify(dockerUpdateObject));
                            return dockerUpdateObject;
                        });
            };
         */
        preDeployFunction =
            preDeployFunction + '\n\n module.exports = preDeployFunction';
        return requireFromString(preDeployFunction);
    }
    updateAppDefinition(appName, instanceCount, envVars, volumes, nodeId, notExposeAsWebApp, forceSsl, ports, repoInfo, customNginxConfig, preDeployFunction) {
        const self = this;
        const dataStore = this.dataStore;
        const dockerApi = this.dockerApi;
        let serviceName;
        const checkIfNodeIdExists = function (nodeIdToCheck) {
            return dockerApi.getNodesInfo().then(function (nodeInfo) {
                for (let i = 0; i < nodeInfo.length; i++) {
                    if (nodeIdToCheck === nodeInfo[i].nodeId) {
                        return;
                    }
                }
                throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'Node ID you requested in not part of the swarm ' +
                    nodeIdToCheck);
            });
        };
        return Promise.resolve()
            .then(function () {
            return dataStore.getAppsDataStore().getAppDefinition(appName);
        })
            .then(function (app) {
            serviceName = dataStore
                .getAppsDataStore()
                .getServiceName(appName);
            // After leaving this block, nodeId will be guaranteed to be NonNull
            if (app.hasPersistentData) {
                if (nodeId) {
                    return checkIfNodeIdExists(nodeId);
                }
                else {
                    if (app.nodeId) {
                        nodeId = app.nodeId;
                    }
                    else {
                        return dockerApi
                            .isServiceRunningByName(serviceName)
                            .then(function (isRunning) {
                            if (!isRunning) {
                                throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'Cannot find the service. Try again in a minute...');
                            }
                            return dockerApi.getNodeIdByServiceName(serviceName, 0);
                        })
                            .then(function (nodeIdRunningService) {
                            if (!nodeIdRunningService) {
                                throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'No NodeId was found. Try again in a minute...');
                            }
                            nodeId = nodeIdRunningService;
                        });
                    }
                }
            }
            else {
                if (volumes && volumes.length) {
                    throw ApiStatusCodes.createError(ApiStatusCodes.ILLEGAL_OPERATION, 'Cannot set volumes for a non-persistent container!');
                }
                if (nodeId) {
                    return checkIfNodeIdExists(nodeId);
                }
            }
        })
            .then(function () {
            return dataStore
                .getAppsDataStore()
                .updateAppDefinitionInDb(appName, instanceCount, envVars, volumes, nodeId, notExposeAsWebApp, forceSsl, ports, repoInfo, Authenticator.get(dataStore.getNameSpace()), customNginxConfig, preDeployFunction);
        })
            .then(function () {
            return self.updateServiceOnDefinitionUpdate(appName);
        })
            .then(function () {
            return self.reloadLoadBalancer();
        });
    }
    isAppBuilding(appName) {
        return !!this.activeBuilds[appName];
    }
    /**
     *
     * @returns the active build that it finds
     */
    isAnyBuildRunning() {
        const activeBuilds = this.activeBuilds;
        for (const appName in activeBuilds) {
            if (!!activeBuilds[appName]) {
                return appName;
            }
        }
        return undefined;
    }
    getBuildStatus(appName) {
        const self = this;
        this.buildLogs[appName] =
            this.buildLogs[appName] || new BuildLog(BUILD_LOG_SIZE);
        return {
            isAppBuilding: self.isAppBuilding(appName),
            logs: self.buildLogs[appName].getLogs(),
            isBuildFailed: self.buildLogs[appName].isBuildFailed,
        };
    }
    logBuildFailed(appName, error) {
        error = (error || '') + '';
        this.buildLogs[appName] =
            this.buildLogs[appName] || new BuildLog(BUILD_LOG_SIZE);
        this.buildLogs[appName].onBuildFailed(error);
    }
    updateServiceOnDefinitionUpdate(appName) {
        const self = this;
        const serviceName = this.dataStore
            .getAppsDataStore()
            .getServiceName(appName);
        const dockerAuthObject = CaptainManager.get().getDockerAuthObject();
        const dataStore = this.dataStore;
        const dockerApi = this.dockerApi;
        let appFound;
        return Promise.resolve()
            .then(function () {
            return dataStore.getAppsDataStore().getAppDefinition(appName);
        })
            .then(function (app) {
            appFound = app;
            return self.createPreDeployFunctionIfExist(app);
        })
            .then(function (preDeployFunction) {
            if (!appFound) {
                throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'App name not found!');
            }
            return dockerApi.updateService(serviceName, undefined, appFound.volumes, appFound.networks, appFound.envVars, undefined, dockerAuthObject, Number(appFound.instanceCount), appFound.nodeId, dataStore.getNameSpace(), appFound.ports, appFound, preDeployFunction);
        });
    }
    reloadLoadBalancer() {
        Logger.d('Updating Load Balancer');
        const self = this;
        return self.loadBalancerManager
            .rePopulateNginxConfigFile(self.dataStore)
            .then(function () {
            Logger.d('sendReloadSignal...');
            return self.loadBalancerManager.sendReloadSignal();
        });
    }
}
module.exports = ServiceManager;
//# sourceMappingURL=ServiceManager.js.map