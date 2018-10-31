const inquirer = require("inquirer")
const chalk = require("chalk")
const request = require("request")
const configstore = require("configstore")
const packagejson = require("../package.json")
const configs = new configstore(packagejson.name, {
  captainMachines: []
})

function requestLogin(serverName, serverAddress, loginCallback) {
  console.log("Your auth token is not valid anymore. Try to login again.")

  const questions = [
    {
      type: "password",
      name: "captainPassword",
      message: "Please enter your password for " + serverAddress,
      validate: function(value) {
        if (value && value.trim()) {
          return true
        }

        return "Please enter your password for " + serverAddress
      }
    }
  ]

  function updateAuthTokenInConfigStoreAndReturn(authToken) {
    const machines = configs.get("captainMachines")

    for (let i = 0; i < machines.length; i++) {
      if (machines[i].name === serverName) {
        machines[i].authToken = authToken

        configs.set("captainMachines", machines)

        console.log("You are now logged back in to " + serverAddress)

        return machines[i]
      }
    }
  }

  inquirer.prompt(questions).then(passwordAnswers => {
    var { captainPassword } = passwordAnswers

    const options = {
      url: serverAddress + "/api/v1/login",
      headers: {
        "x-namespace": "captain"
      },
      method: "POST",
      form: {
        password: captainPassword
      }
    }

    function callback(error, response, body) {
      try {
        if (!error && response.statusCode === 200) {
          const data = JSON.parse(body)

          if (data.status !== 100) {
            throw new Error(JSON.stringify(data, null, 2))
          }

          var newMachineToDeploy = updateAuthTokenInConfigStoreAndReturn(
            data.token
          )

          loginCallback(newMachineToDeploy)

          return
        }

        if (error) {
          throw new Error(error)
        }

        throw new Error(
          response ? JSON.stringify(response, null, 2) : "Response NULL"
        )
      } catch (error) {
        if (error.message) {
          try {
            var errorObj = JSON.parse(error.message)

            if (errorObj.status) {
              console.error(chalk.red("\nError code: " + errorObj.status))

              console.error(
                chalk.red("\nError message:\n\n " + errorObj.description)
              )
            } else {
              throw new Error("NOT API ERROR")
            }
          } catch (ignoreError) {
            console.error(chalk.red(error.message))
          }
        } else {
          console.error(chalk.red(error))
        }

        console.log(" ")
      }

      process.exit(0)
    }

    request(options, callback)
  })
}

function requestLoginAuth(serverAddress, password, authCallback) {
  const options = {
    url: serverAddress + "/api/v1/login",
    headers: {
      "x-namespace": "captain"
    },
    method: "POST",
    form: {
      password: password
    }
  }

  function callback(error, response, body) {
    try {
      if (!error && response.statusCode === 200) {
        const data = JSON.parse(body)

        if (data.status !== 100) {
          throw new Error(JSON.stringify(data, null, 2))
        }

        authCallback(data.token)

        return
      }

      if (error) {
        throw new Error(error)
      }

      throw new Error(
        response ? JSON.stringify(response, null, 2) : "Response NULL"
      )
    } catch (error) {
      if (error.message) {
        try {
          var errorObj = JSON.parse(error.message)

          if (errorObj.status) {
            console.error(chalk.red("\nError code: " + errorObj.status))

            console.error(
              chalk.red("\nError message:\n\n " + errorObj.description)
            )
          } else {
            throw new Error("NOT API ERROR")
          }
        } catch (ignoreError) {
          console.error(chalk.red(error.message))
        }
      } else {
        console.error(chalk.red(error))
      }

      console.log(" ")
    }

    process.exit(0)
  }

  request(options, callback)
}

function isAuthTokenValid(machineToDeploy, appName, isAuthTokenValidCallback) {
  const options = {
    url: machineToDeploy.baseUrl + "/api/v1/user/appDefinitions/",
    headers: {
      "x-namespace": "captain",
      "x-captain-auth": machineToDeploy.authToken
    },
    method: "GET"
  }

  function callback(error, response, body) {
    try {
      if (!error && response.statusCode === 200) {
        const data = JSON.parse(body)

        if (data.status === 1106 || data.status === 1105) {
          isAuthTokenValidCallback(false)
        } else {
          isAuthTokenValidCallback(true)
        }
      }
    } catch (error) {
      // This is just a sanity check. We only fire FALSE (i.e. expired) if we know it's expired or password is wrong
      isAuthTokenValidCallback(true)
    }
  }

  request(options, callback)
}

module.exports = {
  requestLogin,
  requestLoginAuth,
  isAuthTokenValid
}
