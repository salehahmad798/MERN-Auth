import axios from "axios";

const server = "http://localhost/:8080";

const api = axios.create({
  baseURL: server,
  withCredentials: true,
});

let isRefreshing = false;
let failedQueue = [];

const prcessQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};
