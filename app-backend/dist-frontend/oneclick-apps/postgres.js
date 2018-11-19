
(function () {

    var SUCCESS = 'success';
    var ERROR = 'danger';
    var INFO = 'info';

    oneClickAppsRepository["postgres"] = function (apiManager) {

        var getErrorMessageIfExists = apiManager.getErrorMessageIfExists;

        var POSTGRES_USER = 'POSTGRES_USER';
        var POSTGRES_PASSWORD = 'POSTGRES_PASSWORD';
        var POSTGRES_DB = 'POSTGRES_DB';
        var POSTGRES_INITDB_ARGS = 'POSTGRES_INITDB_ARGS';

        var CONTAINER_NAME = 'CONTAINER_NAME';
        var DOCKER_TAG = 'DOCKER_TAG';

        var step1next = {};

        step1next.data = [];
        step1next.data.push({
            label: 'Container Name',
            id: CONTAINER_NAME,
            type: 'text'
        });

        step1next.data.push({
            label: 'OPTIONAL: Docker Tag (default "9.6")',
            labelDesc: 'https://hub.docker.com/r/library/postgres/tags/',
            id: DOCKER_TAG,
            type: 'text'
        });

        step1next.data.push({
            label: 'Postgres Root Username',
            id: POSTGRES_USER,
            type: 'text'
        });
        step1next.data.push({
            label: 'Postgres Root Password',
            id: POSTGRES_PASSWORD,
            type: 'text'
        });
        step1next.data.push({
            label: 'Postgres Default Database',
            id: POSTGRES_DB,
            type: 'text'
        });
        step1next.data.push({
            label: 'OPTIONAL: Arguments for "postgres initdb"',
            labelDesc: 'e.g. --data-checksums',
            id: POSTGRES_INITDB_ARGS,
            type: 'text'
        });

        step1next.process = function (data, step1Callback) {

            // create container and set persistent
            // set env vars and volumes
            // deploy image via dockerfile

            function endWithSuccess() {

                var nodejsCode = 'const client = new Client({ user: "' + data[POSTGRES_USER]
                    + '", host: "srv-captain--' + data[CONTAINER_NAME]
                    + '", database: "' + data[POSTGRES_DB]
                    + '", password: "********", port: 5432})';

                step1Callback({
                    message: {
                        text: 'Postgres is deployed and available as srv-captain--' + data[CONTAINER_NAME]
                            + ':5432 to other apps. For example with NodeJS: ' + nodejsCode,
                        type: SUCCESS
                    },
                    next: null // this can be similar to step1next, in that case the flow continues...
                });
            }

            function endWithError(errorMessage) {
                step1Callback({
                    message: {
                        text: errorMessage,
                        type: ERROR
                    },
                    next: step1next
                });
            }

            // process the inputs:

            var errorMessage = null;


            if (!data[CONTAINER_NAME]) {
                errorMessage = 'Container name is required!';
            } else if (!data[POSTGRES_USER]) {
                errorMessage = 'Root username is required!';
            } else if (!data[POSTGRES_PASSWORD]) {
                errorMessage = 'Root password is required!';
            } else if (!data[POSTGRES_DB]) {
                errorMessage = 'Default DB is required!';
            }

            if (errorMessage) {
                endWithError(errorMessage);
                return;
            }

            var appName = data[CONTAINER_NAME];
            var dockerTag = data[DOCKER_TAG] || '9.6';
            var envVars = [{
                key: POSTGRES_USER,
                value: data[POSTGRES_USER]
            }, {
                key: POSTGRES_PASSWORD,
                value: data[POSTGRES_PASSWORD]
            }, {
                key: POSTGRES_DB,
                value: data[POSTGRES_DB]
            }, {
                key: POSTGRES_INITDB_ARGS,
                value: data[POSTGRES_INITDB_ARGS]
            }];
            var volumes = [{
                volumeName: appName + '-postgres',
                containerPath: '/var/lib/postgresql/data'
            }];

            function createContainer() {

                var hasPersistentData = true;

                apiManager.registerNewApp(appName, hasPersistentData, function (data) {
                    if (getErrorMessageIfExists(data)) {
                        endWithError(getErrorMessageIfExists(data));
                        return;
                    }

                    setupAppDefinition();
                });
            }

            function setupAppDefinition() {

                var appDefinition = {
                    instanceCount: 1,
                    envVars: envVars,
                    notExposeAsWebApp: true,
                    volumes: volumes
                };

                apiManager.updateConfigAndSave(appName, appDefinition, function (data) {
                    if (getErrorMessageIfExists(data)) {
                        endWithError(getErrorMessageIfExists(data));
                        return;
                    }

                    deployDockerfile();
                });
            }

            function deployDockerfile() {

                var captainDefinitionContent = {
                    schemaVersion: 1,
                    dockerfileLines: [
                        "FROM postgres:" + dockerTag
                    ]
                }

                apiManager.uploadCaptainDefinitionContent(appName,
                    JSON.stringify(captainDefinitionContent), function (data) {
                        if (getErrorMessageIfExists(data)) {
                            endWithError(getErrorMessageIfExists(data));
                            return;
                        }

                        endWithSuccess();
                    });
            }

            createContainer();

        }

        var step1 = {};
        step1.message = {
            type: INFO,
            text: 'PostgreSQL, often simply "Postgres", is an object-relational database management system (ORDBMS) with an emphasis on extensibility and standards-compliance. As a database server, its primary function is to store data, securely and supporting best practices, and retrieve it later, as requested by other software applications, be it those on the same computer or those running on another computer across a network (including the Internet). It can handle workloads ranging from small single-machine applications to large Internet-facing applications with many concurrent users.' +
                '\n\n After installation on CaptainDuckDuck, it will be available as srv-captain--YOUR_CONTAINER_NAME at port 5432 to other CaptainDuckDuck apps.' +
                '\n\n Enter your Postgres Configuration parameters and click on next. It will take about a minute for the process to finish.'
        }
        step1.next = step1next;
        return step1;

    }

})();