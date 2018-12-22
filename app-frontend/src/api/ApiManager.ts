import HttpClient from "./HttpClient";
import Logger from "../utils/Logger";

const URL = process.env.REACT_APP_API_URL + "/api/v2";
Logger.dev("API URL: " + URL);

export default class ApiManager {
  private http = new HttpClient(URL);
  private static authToken: string = !!process.env.REACT_APP_IS_DEBUG
    ? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7Im5hbWVzcGFjZSI6ImNhcHRhaW4iLCJ0b2tlblZlcnNpb24iOiJ0ZXN0In0sImlhdCI6MTU0NTE5ODMzMCwiZXhwIjoxNTgxMTk4MzMwfQ.zMVFS1HJuu6vS-d6xEd0B0S_q_1kCozIL2O-g9aUwGc"
    : "";
  constructor() {
    this.http.setAuthToken(ApiManager.authToken);
  }

  destroy() {
    this.http.destroy();
  }

  setAuthToken(authToken: string) {
    ApiManager.authToken = authToken;
    this.http.setAuthToken(authToken);
  }

  static isLoggedIn() {
    return !!ApiManager.authToken;
  }

  getAuthToken(password: string) {
    const http = this.http;

    return Promise.resolve() //
      .then(http.fetch(http.POST, "/login", { password }));
  }

  getCaptainInfo() {
    const http = this.http;

    return Promise.resolve() //
      .then(http.fetch(http.GET, "/user/system/info", {}));
  }

  updateRootDomain(rootDomain: string) {
    const http = this.http;

    return Promise.resolve() //
      .then(
        http.fetch(http.POST, "/user/system/changerootdomain", { rootDomain })
      );
  }

  enableRootSsl(emailAddress: string) {
    const http = this.http;

    return Promise.resolve() //
      .then(http.fetch(http.POST, "/user/system/enablessl", { emailAddress }));
  }

  forceSsl(isEnabled: boolean) {
    const http = this.http;

    return Promise.resolve() //
      .then(http.fetch(http.POST, "/user/system/forcessl", { isEnabled }));
  }

  getAllApps() {
    const http = this.http;

    return Promise.resolve() //
      .then(http.fetch(http.GET, "/user/apps/appDefinitions", {}));
  }

  registerNewApp(appName: string, hasPersistentData: boolean) {
    const http = this.http;

    return Promise.resolve() //
      .then(
        http.fetch(http.POST, "/user/apps/appDefinitions/register", {
          appName,
          hasPersistentData
        })
      );
  }

  enableSslForBaseDomain(appName: string) {
    const http = this.http;

    return Promise.resolve() //
      .then(
        http.fetch(http.POST, "/user/apps/appDefinitions/enablebasedomainssl", {
          appName
        })
      );
  }

  attachNewCustomDomainToApp(appName: string, customDomain: string) {
    const http = this.http;

    return Promise.resolve() //
      .then(
        http.fetch(http.POST, "/user/apps/appDefinitions/customdomain", {
          appName,
          customDomain
        })
      );
  }

  enableSslForCustomDomain(appName: string, customDomain: string) {
    const http = this.http;

    return Promise.resolve() //
      .then(
        http.fetch(
          http.POST,
          "/user/apps/appDefinitions/enablecustomdomainssl",
          {
            appName,
            customDomain
          }
        )
      );
  }

  removeCustomDomain(appName: string, customDomain: string) {
    const http = this.http;

    return Promise.resolve() //
      .then(
        http.fetch(
          http.POST,
          "/user/apps/appDefinitions/removecustomdomain",
          {
            appName,
            customDomain
          }
        )
      );
  }
}
