import { observer } from "mobx-react"
import { observable, action, toJS } from "mobx"
import "./App.css"
import io from "socket.io-client"

const applyPatch = action((v, path, newV) => {
  if (path.length === 0) throw new Error("unable to mutate")
  path = [...path]
  while (path.length > 1) {
    v = v[path.shift()]
  }
  v[path[0]] = newV
})

const mutateSourceOfTruth = (state, patches) => {
  for (const patch of patches) {
    applyPatch(state, patch.path, patch.value)
  }
}

const socket = io.connect("http://localhost:4000/")

const initialLocalClient = {
  loaded: false,
  uid: "" + Math.floor(Math.random() * 1000000000),
  position: {
    x: Math.random() * 300,
    y: Math.random() * 300,
  },
}

const globalState = observable({
  localClient: initialLocalClient,
  centralizedSourceOfTruth: {},
})

const initSourceOfTruth = action((data) => {
  globalState.centralizedSourceOfTruth = data
})

socket.emit("init request", JSON.stringify({ uid: globalState.localClient.uid }))

socket.on("init response", (response) => {
  initSourceOfTruth(JSON.parse(response))

  const wiggleStep = action(() => {
    globalState.localClient.position.x += Math.random() * 20 - 5
    globalState.localClient.position.y += Math.random() * 20 - 5

    socket.emit(
      "new position",
      JSON.stringify({
        uid: globalState.localClient.uid,
        x: globalState.localClient.position.x,
        y: globalState.localClient.position.y,
      })
    )
  })
  setInterval(wiggleStep, 1000) // move the current user once a second

  socket.on("patch for source of truth", (data) => {
    // received patch from server
    const parsedData = JSON.parse(data)
    const patch = parsedData.patch
    mutateSourceOfTruth(globalState.centralizedSourceOfTruth, patch)
  })
})

function PositionedDiv({ x, y, children }) {
  return (
    <div
      style={{
        position: "absolute",
        fontSize: "40px",
        left: `${x}px`,
        top: `${y}px`,
      }}
    >
      {children}
    </div>
  )
}

const App = observer(() => {
  const clients = globalState.centralizedSourceOfTruth.clients
  let otherUIDs = !clients ? [] : Object.keys(clients)
  otherUIDs = otherUIDs.filter((k) => k !== globalState.localClient.uid)
  return (
    <div style={{ position: "absolute" }}>
      <PositionedDiv x={globalState.localClient.position.x} y={globalState.localClient.position.y}>
        X
      </PositionedDiv>
      {otherUIDs.map((k) => (
        <PositionedDiv x={clients[k].position.x} y={clients[k].position.y}>
          O
        </PositionedDiv>
      ))}
    </div>
  )
})

export default App
