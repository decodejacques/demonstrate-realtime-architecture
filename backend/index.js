const express = require("express")
const immer = require("immer")
const app = express()
const http = require("http")
const httpServer = http.createServer(app)
const io = require("socket.io")(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
})

immer.enablePatches()
const produceWithPatches = immer.produceWithPatches

let centralizedSourceOfTruth = { clients: {} }

const mutatingReducer = (state, action) => {
  if (action.type === "client-moved") {
    state.clients[action.uid].position = action.position
    return
  }
  if (action.type === "init-client") {
    state.clients[action.uid] = { position: {} }
    return
  }
}

const updateTruthAndGeneratePatch = (state, action) => {
  const newTruthAndpatches = produceWithPatches(state, (state) => {
    mutatingReducer(state, action)
  })

  centralizedSourceOfTruth = newTruthAndpatches[0]

  return newTruthAndpatches[1]
}

io.on("connection", (client) => {
  const processAction = (action) => {
    const patch = updateTruthAndGeneratePatch(centralizedSourceOfTruth, action)
    io.emit("patch for source of truth", JSON.stringify({ patch })) // emitted to everyone
  }

  client.on("new position", (data) => {
    // received position update from user
    const { x, y, uid } = JSON.parse(data)
    if (!centralizedSourceOfTruth.clients[uid]) {
      console.log("unknown client", uid)
      return
    }
    processAction({
      type: "client-moved",
      uid,
      position: { x, y },
    })
  })
  client.on("init request", (data) => {
    // received init request from user
    const parsedData = JSON.parse(data)
    const uid = parsedData.uid
    processAction({
      type: "init-client",
      uid,
    })
    client.emit("init response", JSON.stringify(centralizedSourceOfTruth)) // emitted to client
  })
  client.on("disconnect", () => {
    /* … */
  })
})

httpServer.listen(4000, () => {
  console.log("listening on *:4000")
})
