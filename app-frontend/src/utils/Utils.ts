import { number } from "prop-types";

export default {
  copyObject<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj)) as T;
  },

  generateUuidV4() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
      var r = (Math.random() * 16) | 0,
        v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
};
