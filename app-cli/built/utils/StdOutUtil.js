"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chalk = require('chalk');
class StdOutUtils {
    printMessage(message) {
        console.log(message);
    }
    printMessageAndExit(message) {
        console.log(message);
        process.exit(0);
    }
    printGreenMessage(message, exit = false) {
        console.log(`${chalk.green(message)}`);
        exit && process.exit(0);
    }
    printMagentaMessage(message, exit = false) {
        console.log(`${chalk.magenta(message)}`);
        exit && process.exit(0);
    }
    printError(error, exit = false) {
        console.log(`${chalk.bold.red(error)}`);
        exit && process.exit(0);
    }
    errorHandler(error) {
        if (error.captainStatus) {
            this.printError(`\nError Code: ${error.captainStatus}  Message:  ${error.captainMessage}`, true);
        }
        else if (error.status) {
            this.printError(`\nError status: ${error.status}  Message:  ${error.description || error.message}`, true);
        }
        else {
            this.printError(`\nError: ${error}`, true);
        }
    }
}
exports.default = new StdOutUtils();
//# sourceMappingURL=StdOutUtil.js.map