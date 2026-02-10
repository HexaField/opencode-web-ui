module.exports = {
  apps: [{
    name: "opencode-web-ui",
    script: "./server/src/index.ts",
    interpreter: "node",
    node_args: ["--env-file=.env.prod", "--import", "tsx"],
    env: {
      NODE_ENV: "production",
      // Ensure we don't carry over development vars if any
    },
    wait_ready: true,
    listen_timeout: 10000,
    kill_timeout: 5000
  }]
}
