import React, { Component } from "react";
import io from "socket.io-client";
import Peer from "simple-peer";
import "./App.css";

//components
const Video = React.forwardRef((props, ref) => (
  <video
    ref={ref}
    {...props}
    style={{
      margin: "2px",
      border: "1px solid black",
      width: "50%",
      height: "50vh",
      padding: "0"
    }}
  />
));

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      yourID: "",
      users: {},
      stream: null,
      callAccepted: false,
      caller: "",
      recevingCall: false,
      callerSignal: null
    };
    //declare the socket
    this.socket = null;
    //create ref for user video
    this.userVideoRef = React.createRef();
    //create ref for partner video
    this.partnerVideoRef = React.createRef();
  }

  componentDidMount() {
    try {
      //initialize the connection with the socket connection with the server
      this.socket = io.connect("http://localhost:4000");

      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then(stream => {
          //set the state
          this.setState({ stream });
          //attach the stream to user video
          if (this.userVideoRef.current)
            this.userVideoRef.current.srcObject = stream;
        })
        .catch(error => console.log(error));

      //listen to events from the server
      //get your own id
      this.socket.on("yourID", yourID => this.setState({ yourID }));

      //get the users, if you are the initiator
      this.socket.on("allUsers", users => this.setState({ users }));

      //listen to any incoming calls
      this.socket.on("hey", data => {
        this.setState({
          recevingCall: true,
          caller: data.from,
          callerSignal: data.signal
        });
      });
    } catch (error) {}
  }

  //handle click events
  //when getting called
  acceptCall = () => {
    const { stream, caller, callerSignal } = this.state;
    this.setState({ callAccepted: true });
    const localPeer = new Peer({
      initiator: false,
      trickle: false,
      //this stream will be fed to partner peer
      stream
    });

    //send signal data back to the calling peer
    //via socket.io server
    localPeer.on("signal", data => {
      this.socket.emit("acceptCall", { signal: data, to: caller });
    });

    localPeer.on("stream", stream => {
      this.partnerVideoRef.current.srcObject = stream;
    });

    localPeer.signal(callerSignal);
  };

  //when calling a peer
  callPeer = id => {
    const { stream, yourID } = this.state;

    //create a new peer object
    const localPeer = new Peer({
      initiator: true,
      trickle: false,
      //this stream will be fed to the partner peer
      stream
    });

    //send signal data to the partner peer
    //via the socket.io server
    localPeer.on("signal", data => {
      this.socket.emit("callUser", {
        userToCall: id,
        signalData: data,
        from: yourID
      });
    });

    //when the stream is ready from partner peer
    localPeer.on("stream", stream => {
      if (this.partnerVideoRef.current)
        this.partnerVideoRef.current.srcObject = stream;
    });

    //accept the signal from partner to complete the handshake
    this.socket.on("callAccepted", signal => {
      this.setState({ callAccepted: true });
      localPeer.signal(signal);
    });
  };

  render() {
    const {
      users,
      yourID,
      stream,
      callAccepted,
      recevingCall,
      caller
    } = this.state;

    return (
      <div
        style={{
          height: "100vh",
          width: "100%",
          display: "flex",
          flexDirection: "column"
        }}
      >
        <h1>YourID: {yourID}</h1>
        <div style={{ display: "flex", width: "100%" }}>
          {stream && (
            <Video playsInline muted ref={this.userVideoRef} autoPlay />
          )}
          {callAccepted && (
            <Video playsInline ref={this.partnerVideoRef} autoPlay />
          )}
        </div>
        <div>
          {Object.keys(users).map(key => {
            if (key === yourID) {
              return null;
            }
            return (
              <button key={key} onClick={() => this.callPeer(key)}>
                Call {key}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", width: "100%" }}>
          {recevingCall && (
            <div>
              <h1>{caller} is calling you</h1>
              <button onClick={this.acceptCall}>Accept</button>
            </div>
          )}
        </div>
      </div>
    );
  }
}

export default App;
