#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const packagejson = require('../../package.json');
const updateNotifier = require("update-notifier");
updateNotifier({ pkg: packagejson }).notify({ isGlobal: true });
const StdOutUtil_1 = require("../utils/StdOutUtil");
const program = require("commander");
// Command actions
const login_1 = require("./login");
const list_1 = require("./list");
const logout_1 = require("./logout");
// import serversetup = require('./serversetup');
// import deploy = require('./deploy');
// Setup
program.version(packagejson.version).description(packagejson.description);
// Commands
program
    .command('login')
    .description('Login to a CaptainDuckDuck machine. You can be logged in to multiple machines simultaneously.')
    .action(() => {
    login_1.default();
});
program.command('list').alias('ls').description('List all Captain machines currently logged in.').action(() => {
    list_1.default();
});
program.command('logout').description('Logout from a specific Captain machine.').action(() => {
    logout_1.default();
});
// program
// 	.command('serversetup')
// 	.description('Performs necessary actions and prepares your Captain server.')
// 	.action(() => {
// 		serversetup();
// 	});
// program
// 	.command('deploy')
// 	.description(
// 		"Deploy your app (current directory) to a specific Captain machine. You'll be prompted to choose your Captain machine."
// 	)
// 	.option('-t, --tarFile <value>', 'Specify file to be uploaded (rather than using git archive)')
// 	.option('-d, --default', 'Run with default options')
// 	.option('-s, --stateless', 'Run deploy stateless')
// 	.option('-h, --host <value>', 'Only for stateless mode: Host of the captain machine')
// 	.option('-a, --appName <value>', 'Only for stateless mode: Name of the app')
// 	.option('-p, --pass <value>', 'Only for stateless mode: Password for Captain')
// 	.option('-b, --branch <value>', 'Only for stateless mode: Branch name (default master)')
// 	.action((options: any) => {
// 		deploy(options);
// 	});
// Error on unknown commands
program.on('command:*', () => {
    const wrongCommands = program.args.join(' ');
    StdOutUtil_1.default.printError(`\nInvalid command: ${wrongCommands}\nSee --help for a list of available commands.`, true);
});
program.parse(process.argv);
//# sourceMappingURL=captainduckduck.js.map