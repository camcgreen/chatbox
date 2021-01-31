import React from "react";
import ChatNavigation from "./ChatNavigation";
import ChatMain from "./ChatMain";
import Sidebar from "./Sidebar";
// import { disableRightMiddleClick } from "../utilities/helper";
// import "./main.scss";
const firebase = require("firebase");

class Dashboard extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      navOpen: true,
      selectedChat: null,
      newChatFormVisible: false,
      email: null,
      friendEmail: null,
      friendName: null,
      chats: [],
      online: false,
      friendOnline: false,
      lastLoggedOut: null,
      friendLastLoggedOut: "",
    };
  }
  render() {
    return (
      <>
        {/* <button
          onClick={this.logOut}
          // style={{ position: "absolute", top: 200, left: 200 }}
        >
          Log out
        </button> */}
        <ChatNavigation
          // zIndexValue={this.state.navOpen ? 20 : 0}
          leftValue={this.state.navOpen ? 0 : "-150vw"}
          toggleNav={this.toggleNav}
          newChat={this.newChat}
          selectChat={this.selectChat}
          chats={this.state.chats}
          email={this.state.email}
          selectedChatIndex={this.state.selectedChat}
          logOut={this.logOut}
        />
        <ChatMain
          toggleNav={this.toggleNav}
          email={this.state.email}
          friendEmail={this.state.friendEmail}
          friendName={this.state.friendName}
          chat={this.state.chats[this.state.selectedChat]}
          newChatFormVisible={this.state.newChatFormVisible}
          sendMessage={this.sendMessage}
          sendGif={this.sendGif}
          navigateToChat={this.navigateToChat}
          createNewChat={this.createNewChat}
          friendOnline={this.state.friendOnline}
          friendLastLoggedOut={this.state.friendLastLoggedOut}
          markMessageAsRead={this.markMessageAsRead}
        />
        <Sidebar
          selectedChat={this.state.selectedChat}
          newChatFormVisible={this.state.newChatFormVisible}
          friendName={this.state.friendName}
          friendEmail={this.state.friendEmail}
          friendsSince={this.state.friendsSince}
        />
      </>
    );
    // return <h1>Dashboard</h1>;
  }
  componentDidMount = async () => {
    document.title = "Chatbox";
    firebase.auth().onAuthStateChanged(async (_usr) => {
      if (!_usr) {
        this.props.history.push("/login");
      } else {
        await this.setState({ email: _usr.email, online: true });
        await this.updateOnlineStatus();
        await firebase
          .firestore()
          .collection("chats")
          .where("users", "array-contains", _usr.email)
          .onSnapshot(async (result) => {
            const chats = result.docs.map((doc) => doc.data());
            await this.setState({ chats });
          });
        console.log(this.state);
        setTimeout(() => {
          if (this.state.chats.length > 0) {
            const chatsToOrder = [...this.state.chats];
            const orderedChats = chatsToOrder.sort(
              (a, b) =>
                b.messages[b.messages.length - 1].timestamp -
                a.messages[a.messages.length - 1].timestamp
            );
            const index = this.state.chats.findIndex(
              (element) => element === orderedChats[0]
            );
            this.selectChat(index);
          }
        }, 400);
      }
    });
  };
  updateOnlineStatus = () => {
    firebase
      .firestore()
      .collection("users")
      .doc(this.state.email)
      .update({ online: this.state.online });
  };
  toggleNav = () => {
    this.setState({ navOpen: !this.state.navOpen });
  };
  navigateToChat = async (docKey, message) => {
    const usersInChat = docKey.split(":");
    const chat = this.state.chats.find((chat) =>
      usersInChat.every((user) => chat.users.includes(user))
    );
    this.setState({ newChatFormVisible: false });
    await this.selectChat(this.state.chats.indexOf(chat));
    this.sendMessage(message);
  };
  createNewChat = async (chat) => {
    const docKey = this.buildDocKey(chat.sendTo);
    await firebase
      .firestore()
      .collection("chats")
      .doc(docKey)
      .set({
        userEmails: [this.state.email, chat.sendTo].sort(),
        messages: [
          {
            message: chat.message,
            sender: this.state.email,
            timestamp: Date.now(),
            gifRef: null,
          },
        ],
        receiverHasRead: false,
        user1Typing: false,
        user2Typing: false,
      });
    this.setState({ newChatFormVisible: false });
    this.selectChat(this.state.chats.length - 1);
  };
  selectChat = async (chatIndex) => {
    console.log("index", chatIndex);
    await this.setState({
      selectedChat: chatIndex,
    });
    this.markMessageAsRead();
    const friendEmail = this.state.chats[this.state.selectedChat].users.filter(
      (user) => user !== this.state.email
    )[0];
    const friendName = await this.findFriendName(friendEmail);
    const friendsSince = new Date(
      this.state.chats[this.state.selectedChat].messages[0].timestamp
    );
    if (this.state.chats.length > 0) {
      await this.setState({ friendEmail, friendName, friendsSince });
      firebase
        .firestore()
        .collection("users")
        .doc(this.state.friendEmail)
        .onSnapshot(async (doc) => {
          await this.setState({
            friendOnline: doc.data().online,
            friendLastLoggedOut: doc.data().lastLoggedOut,
          });
        });
    }
  };
  findFriendName = async (friendEmail) => {
    const doc = await firebase
      .firestore()
      .collection("users")
      .doc(friendEmail)
      .get();
    const nameFirst = doc.data().nameFirst;
    const nameLast = doc.data().nameLast;
    return `${nameFirst} ${nameLast}`;
    // console.log(`${nameFirst} ${nameLast}`);
  };
  selectedChatWhereUserNotSender = (chatIndex) => {
    const selectedChatMessages = this.state.chats[chatIndex].messages;
    return (
      selectedChatMessages[selectedChatMessages.length - 1].sender !==
      this.state.email
    );
  };
  markMessageAsRead = () => {
    const friendEmail = this.state.chats[this.state.selectedChat].users.filter(
      (user) => user !== this.state.email
    )[0];
    const docKey = this.buildDocKey(friendEmail);
    if (this.selectedChatWhereUserNotSender(this.state.selectedChat)) {
      firebase
        .firestore()
        .collection("chats")
        .doc(docKey)
        .update({ receiverHasRead: true });
    } else {
      console.log("selected message where the user was the sender");
    }
  };
  newChat = () => {
    this.setState({
      selectedChat: null,
      newChatFormVisible: true,
    });
  };
  logOut = async () => {
    await this.setState({ online: false, lastLoggedOut: Date.now() });
    await this.updateOnlineStatus();
    await firebase
      .firestore()
      .collection("users")
      .doc(this.state.email)
      .update({ lastLoggedOut: this.state.lastLoggedOut });
    firebase.auth().signOut();
  };
  buildDocKey = (friend) => [this.state.email, friend].sort().join(":");
  sendMessage = (message) => {
    const docKey = this.buildDocKey(
      this.state.chats[this.state.selectedChat].users.filter(
        (user) => user !== this.state.email
      )[0]
    );
    firebase
      .firestore()
      .collection("chats")
      .doc(docKey)
      .update({
        messages: firebase.firestore.FieldValue.arrayUnion({
          sender: this.state.email,
          message,
          timestamp: Date.now(),
          gifRef: null,
        }),
        receiverHasRead: false,
      });
  };
  sendGif = (url) => {
    const docKey = this.buildDocKey(
      this.state.chats[this.state.selectedChat].users.filter(
        (_usr) => _usr !== this.state.email
      )[0]
    );
    firebase
      .firestore()
      .collection("chats")
      .doc(docKey)
      .update({
        // add the message to the message array in the db
        messages: firebase.firestore.FieldValue.arrayUnion({
          sender: this.state.email,
          message: null,
          timestamp: Date.now(),
          gifRef: url,
          receiverRead: false,
        }),
        receiverHasRead: false,
      });
    // this.selectChat(0);
  };
}

export default Dashboard;
