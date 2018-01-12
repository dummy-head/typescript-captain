const program = require('commander');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const inquirer = require('inquirer');
const configstore = require('configstore');
const request = require('request');
const commandExistsSync = require('command-exists').sync;
const ProgressBar = require('progress');
const ora = require('ora');
const { exec } = require('child_process');

const packagejson = require('./package.json');

const configs = new configstore(packagejson.name, {
    captainMachines: [],
    apps: []
});

const BRANCH_TO_PUSH = 'branchToPush';
const APP_NAME = 'appName';
const MACHINE_TO_DEPLOY = 'machineToDeploy';

console.log(' ');
console.log(' ');

program
    .description('Deploy current directory to a Captain machine.')
    .option('-d, --default','Run with default options')
    .parse(process.argv);


if (program.args.length) {
    console.error(chalk.red('Unrecognized commands:'));
    program.args.forEach(function (arg) {
        console.log(chalk.red(arg));
    });
    console.error(chalk.red('Deploy does not require any options. '));
    process.exit(1);
}

function printErrorAndExit(error) {
    console.log(chalk.bold.red(error));
    console.log(' ');
    console.log(' ');
    process.exit(0);
}

if (!fs.pathExistsSync('./.git')) {
    printErrorAndExit('**** ERROR: You are not in a git root directory. This command will only deploys the current directory ****');
}

if (!fs.pathExistsSync('./captain-definition')) {
    printErrorAndExit('**** ERROR: captain-definition file cannot be found. Please see docs! ****');
}

var contents = fs.readFileSync('./captain-definition', 'utf8');
var contentsJson = null;

try {
    contentsJson = JSON.parse(contents);
} catch (e) {
    console.log(e);
    console.log('');
    printErrorAndExit('**** ERROR: captain-definition file is not a valid JSON! ****');
}

if (!contentsJson.schemaVersion) {
    printErrorAndExit('**** ERROR: captain-definition needs schemaVersion. Please see docs! ****');
}

if (!contentsJson.templateId && !contentsJson.dockerfileLines) {
    printErrorAndExit('**** ERROR: captain-definition needs templateId or dockerfileLines. Please see docs! ****');
}

if (contentsJson.templateId && contentsJson.dockerfileLines) {
    printErrorAndExit('**** ERROR: captain-definition needs templateId or dockerfileLines, NOT BOTH! Please see docs! ****');
}

let listOfMachines = [{
    name: '-- CANCEL --',
    value: '',
    short: ''
}];

let machines = configs.get('captainMachines');
for (let i = 0; i < machines.length; i++) {
    let m = machines[i];
    listOfMachines.push({
        name: m.name + ' at ' + m.baseUrl,
        value: m.name,
        short: m.name + ' at ' + m.baseUrl
    })
}

// Gets default value for propType that is stored in a directory.
// Replaces getAppForDirectory
function getPropForDirectory(propType) {
    let apps = configs.get('apps');
    for (let i = 0; i < apps.length; i++) {
        let app = apps[i];
        if (app.cwd === process.cwd()) {
            return app[propType];
        }
    }
    return undefined;
}

// Sets default value for propType that is stored in a directory to propValue.
// Replaces saveAppForDirectory
function savePropForDirectory(propType,propValue) {
    let apps = configs.get('apps');
    for (let i = 0; i < apps.length; i++) {
        let app = apps[i];
        if (app.cwd === process.cwd()) {
            app[propType] = propValue;
            configs.set('apps', apps);
            return;
        }
    }

    apps.push({
        cwd: process.cwd(),
        [propType]: propValue
    });

    configs.set('apps', apps);
}


function getDefaultMachine() {
    let machine = getPropForDirectory(MACHINE_TO_DEPLOY);
    console.log(machine);
    if(machine){
        return machine.name;
    }
    if(listOfMachines.length == 2){
        return 1;
    }
    return 0;
}

console.log('Preparing deployment to Captain...');
console.log(' ');


const questions = [
    {
        type: 'list',
        name: 'captainNameToDeploy',
        default: getDefaultMachine(),
        message: 'Select the Captain Machine you want to deploy to:',
        choices: listOfMachines
    },
    {
        type: 'input',
        default: getPropForDirectory(BRANCH_TO_PUSH) || 'master',
        name: BRANCH_TO_PUSH,
        message: 'Enter the "git" branch you would like to deploy:',
        when: function (answers) {
            return !!answers.captainNameToDeploy;
        }
    },
    {
        type: 'input',
        default: getPropForDirectory(APP_NAME),
        name: APP_NAME,
        message: 'Enter the Captain app name this directory will be deployed to:',
        when: function (answers) {
            return !!answers.captainNameToDeploy;
        }
    },
    {
        type: 'confirm',
        name: 'confirmedToDeploy',
        message: 'Note that uncommited files and files in gitignore (if any) will not be pushed to server. Please confirm so that deployment process can start.',
        default: true,
        when: function (answers) {
            return !!answers.captainNameToDeploy;
        }
    }
];

let defaultInvalid = false;

if(program.default){

    if(!getDefaultMachine() || !getPropForDirectory(BRANCH_TO_PUSH) || !getPropForDirectory(APP_NAME)){
        console.log('Default deploy failed. Please select deploy options.');
        defaultInvalid = true;
    }
    else{
        console.log('Deploying to ' + getPropForDirectory(MACHINE_TO_DEPLOY).name);
        deployTo(getPropForDirectory(MACHINE_TO_DEPLOY),getPropForDirectory(BRANCH_TO_PUSH), getPropForDirectory(APP_NAME));
    }
        
}

if(!program.default || defaultInvalid){

    inquirer.prompt(questions).then(function (answers) {

        console.log(' ');
        console.log(' ');

        if (!answers.confirmedToDeploy) {
            console.log('Operation cancelled by the user...');
            console.log(' ');
        }
        else {
            let machines = configs.get('captainMachines');
            let machineToDeploy = null;
            for (let i = 0; i < machines.length; i++) {
                if (machines[i].name === answers.captainNameToDeploy) {
                    console.log('Deploying to ' + answers.captainNameToDeploy);
                    machineToDeploy = machines[i];
                    break;
                }
            }

            console.log(' ');
            deployTo(machineToDeploy, answers.branchToPush, answers.appName);
        }

    });

}

function deployTo(machineToDeploy, branchToPush, appName) {
    if (!commandExistsSync('git')) {
        console.log(chalk.red('"git" command not found...'));
        console.log(chalk.red('Captain needs "git" to create zip file of your source files...'));
        console.log(' ');
        process.exit(1);
    }

    let zipFileNameToDeploy = 'temporary-captain-to-deploy.zip';
    let zipFileFullPath = path.join(process.cwd(), zipFileNameToDeploy);

    console.log('Saving zip file to:');
    console.log(zipFileFullPath);
    console.log(' ');

    exec('git archive --format tar --output "' + zipFileFullPath + '" ' + branchToPush, function (err, stdout, stderr) {
        if (err) {
            console.log(chalk.red('TAR file failed'));
            console.log(chalk.red(err + ' '));
            console.log(' ');
            fs.removeSync(zipFileFullPath);
            return;
        }

        exec('git rev-parse ' + branchToPush, function (err, stdout, stderr) {

            const gitHash = (stdout || '').trim();

            if (err || !(/^[a-f0-9]{40}$/.test(gitHash))) {
                console.log(chalk.red('Cannot find hash of last commit on this branch: ' + branchToPush));
                console.log(chalk.red(gitHash + ' '));
                console.log(chalk.red(err + ' '));
                console.log(' ');
                return;
            }

            console.log('Pushing last commit on ' + branchToPush + ': ' + gitHash);
            
            
            sendFileToCaptain(machineToDeploy, zipFileFullPath, appName, gitHash, branchToPush);

        });
    });

}

function sendFileToCaptain(machineToDeploy, zipFileFullPath, appName, gitHash, branchToPush) {

    console.log('Uploading file to ' + machineToDeploy.baseUrl);

    const fileSize = fs.statSync(zipFileFullPath).size;
    const fileStream = fs.createReadStream(zipFileFullPath);

    const barOpts = {
        width: 20,
        total: fileSize,
        clear: true
    };
    const bar = new ProgressBar(' uploading [:bar] :percent  (ETA :etas)', barOpts);
    fileStream.on('data', function (chunk) {
        bar.tick(chunk.length);
    });

    let spinner;

    fileStream.on('end', function () {
        console.log(' ');
        console.log('This might take several minutes. PLEASE BE PATIENT...');
        spinner = ora('Building your source code...').start();
        spinner.color = 'yellow';
    });


    let options = {
        url: machineToDeploy.baseUrl + '/api/v1/user/appData/' + appName,
        headers: {
            'x-namespace': 'captain',
            'x-captain-auth': machineToDeploy.authToken
        },
        method: 'POST',
        formData: {
            sourceFile: fileStream,
            gitHash: gitHash
        }
    };

    function callback(error, response, body) {

        if (spinner) {
            spinner.stop();
        }

        if (fs.pathExistsSync(zipFileFullPath)) {
            fs.removeSync(zipFileFullPath);
        }

        try {

            if (!error && response.statusCode === 200) {

                let data = JSON.parse(body);

                if (data.status !== 100) {
                    throw new Error(JSON.stringify(data, null, 2));
                }

                savePropForDirectory(APP_NAME,appName);
                savePropForDirectory(BRANCH_TO_PUSH, branchToPush);                
                savePropForDirectory(MACHINE_TO_DEPLOY, machineToDeploy);

                console.log(chalk.green('Deployed successful: ') + appName);
                console.log(' ');

                return;
            }

            if (error) {
                throw new Error(error)
            }

            throw new Error(response ? JSON.stringify(response, null, 2) : 'Response NULL');

        } catch (error) {

            console.error(chalk.red('\nSomething bad happened. Cannot deploy "' + appName + '"\n'));

            if (error.message) {
                try {
                    var errorObj = JSON.parse(error.message);
                    if (errorObj.status) {
                        console.error(chalk.red('\nError code: ' + errorObj.status));
                        console.error(chalk.red('\nError message:\n\n ' + errorObj.description));
                    } else {
                        throw new Error("NOT API ERROR");
                    }
                } catch (ignoreError) {
                    console.error(chalk.red(error.message));
                }
            } else {
                console.error(chalk.red(error));
            }
            console.log(' ');
        }
    }

    request(options, callback);

}


