import { app } from './server.js'

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err)
})
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

const port = process.env.SERVER_PORT || process.env.PORT || 3001
const host = process.env.SERVER_HOST || '0.0.0.0'
const server = app.listen(Number(port), host, () => {
  console.log(`Server running on port ${port}`)
})

server.on('error', (err) => {
  console.error('Server failed to start:', err)
})
