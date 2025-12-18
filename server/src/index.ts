import { app } from './server.js'

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err)
})
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

const port = process.env.PORT || 3001
app.listen(Number(port), '0.0.0.0', () => {
  console.log(`Server running on port ${port}`)
})
