// Resources:
//
// https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Drawing_text
const {remote, shell} = require('electron')
const {Menu, MenuItem} = remote
const {dialog} = require('electron').remote
const path = require('path')
const csvsync = require('csvsync')
const fs = require('fs')
const os = require("os");
const $ = require('jQuery')
const {app} = require('electron').remote;
const appRootDir = require('app-root-dir').get() //get the path of the application bundle
const ffmpeg = appRootDir+'/ffmpeg/ffmpeg'
const exec = require( 'child_process' ).exec
const si = require('systeminformation');
const naturalSort = require('node-natural-sort')
const mkdirp = require('mkdirp');
const numeric = require('numeric')
var moment = require('moment')
var content = document.getElementById("contentDiv")
var localMediaStream
var sys = {
  modelID: 'unknown',
  isMacBook: false // need to detect if macbook for ffmpeg recording framerate value
}
var exp = new experiment('HAAT')
exp.getRootPath()
exp.getMediaPath()
var fileToSave
var fileHeader = ['subj', 'session', 'assessment', 'level', 'stim1', 'stim2', 'correctResp', 'keyPressed', 'reactionTime', 'accuracy', os.EOL]
var subjID
var sessID
var userDataPath = path.join(app.getPath('userData'),'Data')
makeSureUserDataFolderIsThere()
var savePath
var canvas = document.getElementById('canvas');
var ctx = canvas.getContext('2d');
ctx.font = '48px serif';
nCols = 4
textColumns = []

var gameArea = {
    canvas : canvas,
    start : function() {
        this.context = ctx
        this.interval = setInterval(updateGameArea, 20);
        textColumns = numeric.linspace(0, canvas.width, nCols)
    },
    clear : function() {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    },
    stop : function() {
        clearInterval(this.interval);
    }
}



function getSubjID() {
  var subjID = document.getElementById("subjID").value
  if (subjID === '') {
    subjID = '0'
  }
  return subjID
}

function getSessID() {
  var sessID = document.getElementById("sessID").value
  if (sessID === '') {
    sessID = '0'
  }
  return sessID
}

function shuffle(array) {
  //https://bost.ocks.org/mike/shuffle/
  var m = array.length, t, i;
  // While there remain elements to shuffle…
  while (m) {
    // Pick a remaining element…
    i = Math.floor(Math.random() * m--);
    // And swap it with the current element.
    t = array[m];
    array[m] = array[i];
    array[i] = t;
  }
  return array;
}


//camera preview on
function startWebCamPreview() {
  clearScreen()
  var vidPrevEl = document.createElement("video")
  vidPrevEl.autoplay = true
  vidPrevEl.id = "webcampreview"
  content.appendChild(vidPrevEl)
  navigator.webkitGetUserMedia({video: true, audio: false},
    function(stream) {
      localMediaStream = stream
      vidPrevEl.src = URL.createObjectURL(stream)
    },
    function() {
      alert('Could not connect to webcam')
    }
  )
}


// camera preview off
function stopWebCamPreview () {
  if(typeof localMediaStream !== "undefined")
  {
    localMediaStream.getVideoTracks()[0].stop()
    clearScreen()
  }
}


// get date and time for appending to filenames
function getDateStamp() {
  ts = moment().format('MMMM Do YYYY, h:mm:ss a')
  ts = ts.replace(/ /g, '-') // replace spaces with dash
  ts = ts.replace(/,/g, '') // replace comma with nothing
  ts = ts.replace(/:/g, '-') // replace colon with dash
  console.log('recording date stamp: ', ts)
  return ts
}


// runs when called by systeminformation
function updateSys(ID) {
  sys.modelID = ID
  if (ID.includes("MacBook") == true) {
    sys.isMacBook = true
  }

  //console.log("updateSys has updated!")
  //console.log(ID.includes("MacBook"))
  //console.log(sys.isMacBook)
} // end updateSys

si.system(function(data) {
  console.log(data['model']);
  updateSys(data['model'])
})


// open data folder in finder
function openDataFolder() {
  dataFolder = savePath
  if (!fs.existsSync(dataFolder)) {
    mkdirp.sync(dataFolder)
  }
  shell.showItemInFolder(dataFolder)
}


function makeSureUserDataFolderIsThere(){
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath)
  }
}


function chooseFile() {
  console.log("Analyze a file!")
  dialog.showOpenDialog(
    {title: "Video Treatment Analysis",
    defaultPath: savePath,
    properties: ["openFile"]},
  analyzeSelectedFile)
}


function analyzeSelectedFile(filePath) {
  console.log("file chosen: ", filePath)
}


// get timestamp (milliseconds since file loaded)
function getTime() {
  return performance.now()
}


// read csv file. This is how experiments will be controlled, query files to show, etc.
function readCSV(filename){
  var csv = fs.readFileSync(filename)
  var stim = csvsync.parse(csv, {
    skipHeader: false,
    returnObject: true
  })
  //var stim = csvReader(filename)
  console.log(stim)
  return stim
  //stim = readCSV(myfile)
  //console.log(stim)
  //var myfile = __dirname+'/experiments/pnt/assets/txt/pntstim.csv'
}



// remove all child elements from a div, here the convention will be to
// remove the elements from "contentDiv" after a trial
function clearScreen() {
  while (canvas.hasChildNodes()) {
    canvas.removeChild(canvas.lastChild)
  }
  console.log("cleared the screen!")
}


// show text instructions on screen
function showInstructions(txt) {
  trialOrder = shuffle(randomArray)
  totalAccArray = []
  dir = path.join(savePath, 'PolarData', 'PhonTx', getSubjID(), getSessID())
  if (!fs.existsSync(dir)) {
      mkdirp.sync(dir)
    }
  fileToSave = path.join(dir,subjID+'_'+sessID+'_PhonTx_level_'+level+'_'+getDateStamp()+'.csv')
  clearScreen()
  var textDiv = document.createElement("div")
  textDiv.style.textAlign = 'center'
  var p = document.createElement("p")
  var txtNode = document.createTextNode(txt)
  p.appendChild(txtNode)
  textDiv.appendChild(p)
  var lineBreak = document.createElement("br")
  var startBtnDiv = document.createElement("div")
  var startBtn = document.createElement("button")
  var startBtnTxt = document.createTextNode("Start")
  startBtn.appendChild(startBtnTxt)
  startBtn.onclick = function() {
    showNextTrial(level)
  }
  startBtnDiv.appendChild(startBtn)
  var practiceBtnDiv = document.createElement("div")
  var practiceBtn = document.createElement("button")
  var practiceBtnTxt = document.createTextNode("Practice")
  practiceBtn.appendChild(practiceBtnTxt)
  practiceBtn.onclick = function() {
    showNextPracticeTrial(level)
  }
  practiceBtnDiv.appendChild(practiceBtn)
  content.appendChild(textDiv)
  content.appendChild(lineBreak)
  content.appendChild(startBtnDiv)
  content.appendChild(lineBreak)
  content.appendChild(practiceBtnDiv)
  return getTime()
}



function stopRecordingAndShowNav() {
  clearScreen()
  openNav()
}



function clearScreenAndStopRecording() {
  clearScreen()
  openNav()
}



function waitSecs(secs) {
  var start = performance.now()
  console.log("waitSecs started at: ", start)
  var end = start
  while(end < (start + (secs*1000))) {
    end = performance.now()
 }
 console.log("waitSecs waited: ", end-start)
}


// wait for time (in ms) and then run the supplied function.
// for now, the supplied function can only have one input variable.
// this WILL HANG the gui
function waitThenDoSync(ms, doneWaitingCallback, arg){
   var start = performance.now()
   var end = start;
   while(end < start + ms) {
     end = performance.now()
  }
  if (arg !== undefined) {
    doneWaitingCallback(arg)
  } else {
    doneWaitingCallback()
  }
}


// wait for time (in ms) and then run the supplied function.
// for now, the supplied function can only have one input variable. (this does not hang gui)
function waitThenDoAsync (ms, doneWaitingCallback, arg) {
  start = performance.now()
  setTimeout(function () {
    if (arg !== undefined) {
      doneWaitingCallback(arg)
    } else {
      doneWaitingCallback()
    }
    end = performance.now()
    console.log('Actual waitThenDo() time: ', end - start)
  }, ms)
}


 // keys object for storing keypress information
var keys = {
  key : '',
  time : 0,
  rt: 0,
  specialKeys: [' ', 'Enter', 'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Shift', 'Tab', 'BackSpace'],
  letterKeys: 'abcdefghijklmnopqrstuvwxyz'.split(''),
  alphaNumericKeys: 'abcdefghijklmnopqrstuvwxyz1234567890'.split(''), // inspired by: http://stackoverflow.com/a/31755504/3280952
  whiteList: function () {
    return this.alphaNumericKeys.concat(this.specialKeys)
  },
  blackList: [],
  isAllowed: function () {
    idx = this.whiteList().indexOf(this.key)
    var val = false
    if (idx > 0) {
      val = true
    } else {
      val = false
    }
    return val
  }
}


// experiment object for storing session parameters, etc.
function experiment(name) {
  this.beginTime= 0,
  this.endTime= 0,
  this.duration= 0,
  this.name= name,
  this.rootpath= '',
  this.mediapath= '',
  this.getDuration = function () {
    return this.endTime - this.beginTime
  },
  this.setBeginTime = function() {
    this.beginTime = performance.now()
  },
  this.setEndTime = function () {
    this.endTime = performance.now()
  },
  this.getMediaPath = function () {
    this.mediapath = path.join(__dirname, '/assets/')
    return this.mediapath
  },
  this.getRootPath = function () {
    this.rootpath = path.join(__dirname,'/')
    return this.rootpath
  }
}


function appendTrialDataToFile(fileToAppend, dataArray) {
  dataArray.push(os.EOL)
  dataString = csvsync.stringify(dataArray)
  if (!fs.existsSync(fileToAppend)) {
    fs.appendFileSync(fileToAppend, fileHeader)
    fs.appendFileSync(fileToAppend, dataArray)
  } else {
    fs.appendFileSync(fileToAppend, dataArray)
  }
  console.log("appended file: ", fileToAppend)
}


// update keys object when a keydown event is detected
function updateKeys() {
  // gets called from: document.addEventListener('keydown', updateKeys);
  iti = 1500 // milliseconds
  fbTime = 750
  keys.key = event.key
  keys.time = performance.now() // gives ms
  keys.rt = 0
  console.log("key: " + keys.key)
  if (keys.key === '1' || keys.key === '2') {
    if (!isPractice) {
      clearScreen()
      accuracy = checkAccuracy()
      totalAccArray.push(accuracy)
      totalAcc = mean(totalAccArray)
      console.log('total acc: ', totalAcc)
      console.log("accuracy: ", accuracy)
      keys.rt = getRT()
      console.log("RT: ", keys.rt)
      showFeedback(accuracy)
      setTimeout(clearScreen, fbTime)
      //['subj', 'session', 'assessment', 'level', 'stim1', 'stim2', 'correctResp', 'keyPressed', 'reactionTime', 'accuracy', os.EOL]
      appendTrialDataToFile(fileToSave, [subjID, sessID, 'PhonTx', level, trials[trialOrder[t]].stim1.trim(), trials[trialOrder[t]].stim2.trim(), trials[trialOrder[t]].correctResp.trim(), keys.key, keys.rt, accuracy])
      //waitSecs(1.5)
      setTimeout(function() {showNextTrial(level)}, iti + fbTime)
    } else if (isPractice) {
      clearScreen()
      accuracy = checkAccuracy()
      totalAccArray.push(accuracy)
      totalAcc = mean(totalAccArray)
      console.log('total acc: ', totalAcc)
      console.log("accuracy: ", accuracy)
      keys.rt = getRT()
      console.log("RT: ", keys.rt)
      showFeedback(accuracy)
      setTimeout(clearScreen, fbTime)
      setTimeout(function() {showNextPracticeTrial(level)}, iti + fbTime)
    }
  } else if (keys.key === 'ArrowLeft') {

  }
}


function mean(arrayToAvg) {
  var sum = arrayToAvg.reduce((previous, current) => current += previous);
  var avg = sum / arrayToAvg.length;
  return avg
}


// store state of navigation pane
var nav = {
  hidden: false
}


function clearAllTimeouts() {
  //clearTimeout(trialTimeoutID)
}


// open navigation pane
function openNav() {
  clearAllTimeouts()
  document.getElementById("navPanel").style.width = "150px"
  document.getElementById("contentDiv").style.marginLeft = "150px"
  document.body.style.backgroundColor = "rgba(0,0,0,0.3)"
  if (document.getElementById("imageElement")) {
    document.getElementById("imageElement").style.opacity = "0.1";
  }
  document.getElementById("closeNavBtn").innerHTML = "&times;"
}


// close navigation pane
function closeNav() {
    document.getElementById("navPanel").style.width = "0px";
    document.getElementById("contentDiv").style.marginLeft= "0px";
    document.getElementById("contentDiv").style.width= "100%";
    document.body.style.backgroundColor = "white";
    //document.getElementById("menuBtn").innerHTML = "&#9776;"
    if (document.getElementById("imageElement")) {
      document.getElementById("imageElement").style.opacity = "1";
    }
    resizeCanvas();
}

function resizeCanvas() {
  var c = document.getElementById("canvas");
  c.width = window.innerWidth;
  c.height = window.innerHeight;
}


function getColCoords(nCols) {

}


// toggle navigation pane, detect if hidden or not
function toggleNav() {
  if (nav.hidden) {
    openNav()
    nav.hidden = false
  } else {
    closeNav()
    nav.hidden = true
  }
}


// check if key that was pressed was the escape key or q. Quits experiment immediately
function checkForEscape() {
  key = event.key
  if (key === "Escape" || key=== "q") {
    console.log("Escape was pressed")
    openNav()
    nav.hidden = false
    // unloadJS(exp.name)
    clearScreen()
    resetVars()
  }
}


function resetVars() {

}

function getStarted() {
  // resetVars()
  // subjID = document.getElementById("subjID").value
  // sessID = document.getElementById("sessID").value
  // level = document.getElementById("levelID").value
  // console.log("level chosen: ", level)
  // if (subjID === '' || sessID === '' || level === '') {
  //   console.log ('subject, session, or level is blank')
  //   alert('subject, session, or level is blank')
  // } else {
  //   console.log ('subject is: ', subjID)
  //   console.log('session is: ', sessID)
  //   stopWebCamPreview()
  //   closeNav()
  //   showInstructions(level1Instructions)
  // }
  closeNav()
  ctx.fillText('Hello world', 0, 0);
  tm = ctx.measureText('HelloWorld')
  console.log("BB Left: ", tm.actualBoundingBoxLeft)
  console.log("BB Right: ", tm.actualBoundingBoxRight)
  console.log("BB top: ", tm.actualBoundingBoxAscent)
  console.log("BB bottom: ", tm.actualBoundingBoxDescent)
  gameArea.start()
}

function textComponent(text, x, y, color) {
  measurements = ctx.measureText(text)
  this.x = x;
  this.y = y;
  this.left = x
  this.right = x + measurements.actualBoundingBoxRight
  this.top = y
  this.bottom = y + measurements.actualBoundingBoxDescent
  this.width = this.right - this.left;
  this.height = this.bottom - this.top;
  this.speedX = 0;
  this.speedY = 0;
  this.update = function() {
    ctx.fillText(text, x, y);
  }
  this.newPos = function() {
    this.x += this.speedX;
    this.y += this.speedY;
  }
  this.crashWith = function(otherobj) {
        var myleft = this.left
        var myright = this.right
        var mytop = this.top
        var mybottom = this.bottom
        var otherleft = otherobj.left;
        var otherright = otherobj.right
        var othertop = otherobj.top
        var otherbottom = otherobj.bottom
        var crash = true;
        if ((mybottom < othertop) ||
               (mytop > otherbottom) ||
               (myright < otherleft) ||
               (myleft > otherright)) {
           crash = false;
        }
        return crash;
    }
}


function Paddle(x, y, width, height, color) {
  this.x = x
  this.y = y
  this.width = width
  this.height = height
  this.left = this.x
  this.right = this.x + this.width
  this.top = this.y
  this.bottom = this.y + this.height
  this.speedX = 0;
  this.speedY = 0;
  this.update = function(newX, newY) {
    ctx.fillStyle = color;
    this.x = newX
    this.y = newY
    ctx.fillRect(this.x, this.y, this.width, this.height);
  }
  this.newPos = function() {
    this.x += this.speedX;
    this.y += this.speedY;
  }
  this.crashWith = function(otherobj) {
        var myleft = this.left
        var myright = this.right
        var mytop = this.top
        var mybottom = this.bottom
        var otherleft = otherobj.left;
        var otherright = otherobj.right
        var othertop = otherobj.top
        var otherbottom = otherobj.bottom
        var crash = true;
        if ((mybottom < othertop) ||
               (mytop > otherbottom) ||
               (myright < otherleft) ||
               (myleft > otherright)) {
           crash = false;
        }
        return crash;
    }
}


function updateGameArea() {
    if (myGamePiece.crashWith(myObstacle)) {
        myGameArea.stop();
    } else {
        myGameArea.clear();
        myObstacle.update();
        myGamePiece.newPos();
        myGamePiece.update();
    }
}


function startGame() {
    paddle = new Paddle(500, 500, 100, 20, "black");
    myGameArea.start();
}


function draw(e) {
    var pos = getMousePos(canvas, e);
    posx = pos.x - (paddle.width/2);
    posy = pos.y - (paddle.height/2);
    paddle.update(posx, posy)
}


function getMousePos(canvas, evt) {
    var rect = canvas.getBoundingClientRect();
    return {
        x: (evt.clientX - rect.left) / (rect.right - rect.left) * canvas.width,
        y: (evt.clientY - rect.top) / (rect.bottom - rect.top) * canvas.height
    };
}


function showSummary() {

}


function resetTrialNumber() {
  t = -1
}

// event listeners that are active for the life of the application
document.addEventListener('keyup', checkForEscape)
document.addEventListener('keyup', updateKeys)
window.addEventListener('mousemove', drawPaddle, false);
