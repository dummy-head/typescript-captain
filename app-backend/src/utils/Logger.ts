/**
 * Created by kasra on 27/06/17.
 */
const CaptainConstants = require("./CaptainConstants");
const moment = require("moment");

function errorize(error: any) {

    if (!(error instanceof Error)) {
        return new Error("Wrapped: " + (error ? error : "NULL"));
    }

    return error;
}

function getTime() {
    return "\x1b[36m" + moment().format("MMMM Do YYYY, h:mm:ss.SSS a    ") + "\x1b[0m";
}


export = {

    d: function(msg: string) {

        console.log(getTime() + msg + "");

    },

    w: function(msg: string) {

        console.log(getTime() + msg + "");

    },

    dev: function(msg: string) {

        if (CaptainConstants.isDebug) {
            console.log(getTime() + "########### " + msg + "");
        }

    },

    e: function(msgOrError: any) {

        let err = errorize(msgOrError);
        console.error(getTime() + err + "\n" + err.stack);

    },

};