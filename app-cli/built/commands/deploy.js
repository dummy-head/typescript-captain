#!/usr/bin/env node
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const MachineHelper_1 = require("../helpers/MachineHelper");
const inquirer = require('inquirer');
const DeployApi = require('../api/DeployApi');
const LoginApi = require('../api/LoginApi');
const { printError, printMessage } = require('../utils/messageHandler');
const { validateIsGitRepository, validateDefinitionFile, optionIsNotGiven, validateAuthentication } = require('../utils/validationsHandler');
const { uploadFile } = require('../utils/fileHelper');
const { gitArchiveFile } = require('../utils/fileHelper');
const fs = require('fs-extra');
const path = require('path');
const commandExistsSync = require('command-exists').sync;
const { initMachineFromLocalStorage } = require('../utils/machineUtils');
function deployAsDefaultValues() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const isValidAuthentication = yield validateAuthentication();
            if (isValidAuthentication) {
                const { appName, branchToPush, machineToDeploy } = DeployApi;
                if (!appName || !branchToPush || !machineToDeploy) {
                    printError('Default deploy failed. There are no default options selected.', true);
                }
                printMessage(`Deploying to ${machineToDeploy.name}`);
                deployFromGitProject();
            }
            else {
                printError('Incorrect login details', true);
            }
        }
        catch (e) {
            printError(e.message, true);
        }
    });
}
function deployAsStateless(host, appName, branch, pass) {
    return __awaiter(this, void 0, void 0, function* () {
        const isStateless = host && appName && branch && pass;
        if (isStateless) {
            // login first
            printMessage(`Trying to login to ${host}\n`);
            const { name } = DeployApi.machineToDeploy;
            const response = yield LoginApi.loginMachine(host, pass);
            const data = JSON.parse(response);
            const newToken = data.token;
            // Update the token to the machine that corresponds (if needed)
            MachineHelper_1.default.updateMachineAuthToken(name, newToken);
            if (data) {
                printMessage(`Starting stateless deploy to\n${host}\n${branch}\n${appName}`);
                deployFromGitProject();
            }
        }
        else {
            printError('You are missing parameters for deploying on stateless. <host> <password> <app name> <branch>');
        }
    });
}
function deployFromTarFile(tarFile) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const isValidAuthentication = yield validateAuthentication();
            if (isValidAuthentication) {
                // Send from tar file
                const filePath = tarFile;
                const gitHash = 'sendviatarfile';
                yield uploadFile(filePath, gitHash);
            }
            else {
                printError('Incorrect login details', true);
            }
        }
        catch (e) {
            printError(e.message, true);
        }
    });
}
function deployFromGitProject() {
    if (!commandExistsSync('git')) {
        printError("'git' command not found...");
        printError("Captain needs 'git' to create tar file of your source files...", true);
    }
    const zipFileNameToDeploy = 'temporary-captain-to-deploy.tar';
    const zipFileFullPath = path.join(process.cwd(), zipFileNameToDeploy);
    printMessage(`Saving tar file to:\n${zipFileFullPath}\n`);
    // Removes the temporarly file created
    try {
        const tempFileExists = fs.pathExistsSync(zipFileFullPath);
        if (tempFileExists) {
            fs.removeSync(zipFileFullPath);
        }
    }
    catch (e) {
        // IgnoreError
    }
    gitArchiveFile(zipFileFullPath, DeployApi.branchToPush);
}
function deploy(options) {
    return __awaiter(this, void 0, void 0, function* () {
        // Reads local storage and sets the machine if found
        initMachineFromLocalStorage();
        if (!options.tarFile || !options.stateless) {
            validateIsGitRepository();
            validateDefinitionFile();
        }
        printMessage('Preparing deployment to Captain...\n');
        if (options.default) {
            deployAsDefaultValues();
        }
        else if (options.stateless) {
            deployAsStateless(options.host, options.appName, options.branch, options.pass);
        }
        else if (options.tarFile) {
            deployFromTarFile(options.tarFile);
        }
        else {
            const questions = [
                {
                    type: 'list',
                    name: 'captainNameToDeploy',
                    default: DeployApi.machineToDeploy.name || '',
                    message: 'Select the Captain Machine you want to deploy to:',
                    choices: MachineHelper_1.default.getMachinesAsOptions(),
                    when: () => optionIsNotGiven(options, 'host')
                },
                {
                    type: 'input',
                    default: DeployApi.branchToPush || 'master',
                    name: 'branchToPush',
                    message: "Enter the 'git' branch you would like to deploy:",
                    when: () => optionIsNotGiven(options, 'branch')
                },
                {
                    type: 'input',
                    default: DeployApi.appName,
                    name: 'appName',
                    message: 'Enter the Captain app name this directory will be deployed to:',
                    when: () => optionIsNotGiven(options, 'appName')
                },
                {
                    type: 'confirm',
                    name: 'confirmedToDeploy',
                    message: 'Note that uncommitted files and files in gitignore (if any) will not be pushed to server. Please confirm so that deployment process can start.',
                    default: true,
                    when: () => optionIsNotGiven(options, 'stateless')
                }
            ];
            const answers = yield inquirer.prompt(questions);
            if (!answers.confirmedToDeploy && !options.stateless) {
                printMessage('\nOperation cancelled by the user...\n');
                process.exit(0);
            }
            const captainNameToDeploy = answers.captainNameToDeploy;
            const branchToPush = answers.branchToPush || options.branch;
            const appName = answers.appName || options.appName;
            DeployApi.updateMachineToDeploy(captainNameToDeploy || options.host);
            DeployApi.setBranchToPush(branchToPush);
            DeployApi.setAppName(appName);
            printMessage(`Deploying to ${DeployApi.machineToDeploy.name}`);
            // Normal deploy
            if (answers.confirmedToDeploy) {
                try {
                    const isValidAuthentication = yield validateAuthentication();
                    if (isValidAuthentication) {
                        deployFromGitProject();
                    }
                    else {
                        printError('Incorrect login details', true);
                    }
                }
                catch (e) {
                    printError(e.message, true);
                }
            }
        }
    });
}
module.exports = deploy;
//# sourceMappingURL=deploy.js.map