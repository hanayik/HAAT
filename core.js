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
var FontFaceObserver = require('fontfaceobserver');
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
var phonFileHeader = ['subj', 'runNum', 'sex', 'word', 'hit', 'freq', 'imagability', 'concreteness', 'meaning', 'posInWord', 'hasS', 'numLetters', 'rateOfFall', 'numSyl', 'isTarget', 'scrXpos', os.EOL]
var semFileHeader = ['subj', 'runNum', 'sex', 'word', 'hit', 'numLetters', 'rateOfFall', 'numSyl', 'isTarget', 'scrXpos', os.EOL]
var spaceFileHeader = ['subj', 'runNum', 'sex', 'word', 'hit', 'rateOfFall', 'isTarget', 'scrXpos', 'scrYpos', 'mouseX', 'mouseY', 'dxFromMouse', os.EOL]
var currentFileHeader
var subjID
var sessID
var sexID
var userDataPath = path.join(app.getPath('userData'),'Data')
makeSureUserDataFolderIsThere()
var savePath
var haatPhonStim = readCSV(path.resolve(exp.mediapath, 'HAATstimsPhon.csv'))
var haatSemStim = readCSV(path.resolve(exp.mediapath, 'HAATstimsSem.csv'))
var haatPhonInstructions = "phon"
var haatSemInstructions = "sem"
var haatSpatialInstructions = "spatial"
var canvas = document.getElementById('canvas')
var ctx = canvas.getContext('2d')
var font = new FontFaceObserver('filledBlock');
font.load().then(function () {
  console.log('*** My Family has loaded ***');
  canvas.style.fontFamily = 'filledBlock'
  ctx.font = '48px filledBlock'
});
var nCols = 4
var textColumns = []
var paddle = new Paddle(500, 500, 100, 20, "black");
var mouseX = 0
var mouseY = 0
var word1 = new textComponent('one', textColumns[0], 200, 'black')
var word2 = new textComponent('two', textColumns[1], 200, 'black')
var word3 = new textComponent('three', textColumns[2], 200, 'black')
var word4 = new textComponent('four', textColumns[3], 200, 'black')
var allObstacles = []
var slowSpeed = 2
var fastSpeed = 4
var stimIdx = 0
var stimList
var numberOfStims
var d
var gameArea = {
  canvas : canvas,
  ctx : ctx,
  start : function() {
    this.interval = setInterval(updateGameArea, 10);
    textColumns = numeric.linspace(0, canvas.width, nCols+2)
    textColumns = textColumns.slice(1,textColumns.length - 1)
    textColumns = textColumns.map(element => element - (Math.round(textColumns[0]/3)));
  },
  clear : function() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
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

function getSexID() {
  var sexID = document.getElementById("sexID").value
  if (sexID === '') {
    sexID = 'NA'
  }
  return sexID
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


function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
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
  //trialOrder = shuffle(randomArray)
  //totalAccArray = []
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
    gameArea.start()
  }
  startBtnDiv.appendChild(startBtn)
  var practiceBtnDiv = document.createElement("div")
  var practiceBtn = document.createElement("button")
  var practiceBtnTxt = document.createTextNode("Practice")
  practiceBtn.appendChild(practiceBtnTxt)
  practiceBtn.onclick = function() {
    gameArea.start()
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


function appendTrialDataToFile(fileHeader, fileToAppend, dataArray) {
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
      //appendTrialDataToFile(fileToSave, [subjID, sessID, 'PhonTx', level, trials[trialOrder[t]].stim1.trim(), trials[trialOrder[t]].stim2.trim(), trials[trialOrder[t]].correctResp.trim(), keys.key, keys.rt, accuracy])
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
  //var c = document.getElementById("canvas");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
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
    clearScreen()
    resetVars()
    gameArea.stop()
    gameArea.clear()

  }
}


function resetVars() {

}

function getStarted() {
  // resetVars()
  subjID = document.getElementById("subjID").value
  sessID = document.getElementById("sessID").value
  sexID = document.getElementById("sexID").value
  assessment = document.getElementById("assessmentID").value
  console.log("assessment chosen: ", assessment)
  if (subjID === '' || sessID === '' || assessment === '') {
    console.log ('subject, session, or assessment is blank')
    alert('subject, session, or assessment is blank')
    return
  } else {
    console.log ('subject is: ', subjID)
    console.log('session is: ', sessID)
    stopWebCamPreview()
    closeNav()
    stimIdx = 0
    if (assessment === 'haatPhon') {
      stimList = shuffle(haatPhonStim)
      currentFileHeader = phonFileHeader
      //showInstructions(haatPhonInstructions)
      dir = path.join(savePath, 'PolarData', 'HAATPhon', getSubjID(), getSessID())
      if (!fs.existsSync(dir)) {
          mkdirp.sync(dir)
        }
      fileToSave = path.join(dir,subjID+'_'+sessID+'_'+assessment+'_'+getDateStamp()+'.csv')
    } else if (assessment === 'haatSem') {
      stimList = shuffle(haatSemStim)
      currentFileHeader = semFileHeader
      //showInstructions(haatSemInstructions)
      dir = path.join(savePath, 'PolarData', 'HAATSem', getSubjID(), getSessID())
      if (!fs.existsSync(dir)) {
          mkdirp.sync(dir)
        }
      fileToSave = path.join(dir,subjID+'_'+sessID+'_'+assessment+'_'+getDateStamp()+'.csv')
    } else if (assessment === 'haatSpatial') {
      stimList = shuffle(haatSpatialStim)
      currentFileHeader = spaceFileHeader
      //showInstructions(haatSpatialInstructions)
      dir = path.join(savePath, 'PolarData', 'HAATSpatial', getSubjID(), getSessID())
      if (!fs.existsSync(dir)) {
          mkdirp.sync(dir)
        }
      fileToSave = path.join(dir,subjID+'_'+sessID+'_'+assessment+'_'+getDateStamp()+'.csv')
    }
    word1.update(stimList[0].word,textColumns[0],0,'black',getRandomInt(slowSpeed,fastSpeed))
    word2.update(stimList[1].word,textColumns[1],0,'black',getRandomInt(slowSpeed,fastSpeed))
    word3.update(stimList[2].word,textColumns[2],0,'black',getRandomInt(slowSpeed,fastSpeed))
    word4.update(stimList[3].word,textColumns[3],0,'black',getRandomInt(slowSpeed,fastSpeed))
    numberOfStims = stimList.length-1
    gameArea.start()
  }
  closeNav()
}

function drawText () {
  //gameArea.clear()
  word1.animate(0)
  word2.animate(1)
  word3.animate(2)
  word4.animate(3)
  allObstacles = [word1, word2, word3, word4]
}

function textComponent(text, x, y, color) {
  this.rateOfFall = getRandomInt(slowSpeed,fastSpeed)
  this.text = text
  this.color = color
  this.measurements = ctx.measureText(text)
  this.x = x;
  this.y = y;
  this.left = this.x
  this.right = this.x + this.measurements.actualBoundingBoxRight
  this.top = this.y - this.measurements.actualBoundingBoxDescent
  this.bottom = this.y
  this.width = this.right - this.left;
  this.height = this.bottom - this.top;
  this.update = function(newText, colIdx, newY, newColor, rateOfFall) {
    if (newText === undefined) {
      newText = 'text'
    }
    if (colIdx === undefined) {
      colIdx = 0
    }
    if (newY === undefined) {
      newY = this.y
    }
    if (newColor === undefined) {
      newColor = this.color
    }
    this.rateOfFall = rateOfFall
    this.text = newText
    this.x = textColumns[colIdx]
    this.y = newY
    this.color = newColor
    this.measurements = ctx.measureText(this.text)
    this.left = this.x
    this.right = this.x + this.measurements.actualBoundingBoxRight
    this.top = this.y - this.measurements.actualBoundingBoxDescent
    this.bottom = this.y
    this.width = this.right - this.left;
    this.height = this.bottom - this.top;
    ctx.fillText(this.text, this.x, this.y);
  }
  this.animate = function(colIdx) {
    //this.rateOfFall = rateOfFall
    this.x = textColumns[colIdx]
    this.measurements = ctx.measureText(this.text)
    this.y += this.rateOfFall;
    this.left = this.x
    this.right = this.x + this.measurements.actualBoundingBoxRight
    this.top = this.y - this.measurements.actualBoundingBoxDescent
    this.bottom = this.y
    this.width = this.right - this.left;
    this.height = this.bottom - this.top;
    ctx.fillText(this.text, this.x, this.y);
    // if goes offscreen
    // if (this.y > canvas.height) {
    //   this.save(d)
    //   stimIdx += 1
    //   if (stimIdx > numberOfStims) {
    //     stimIdx = 0
    //   }
    //   this.update(stimList[stimIdx].word, colIdx, 0, 'black', getRandomInt(slowSpeed,fastSpeed))
    //   console.log("stimIdx: ", stimIdx)
    // } else {
    //   this.left = this.x
    //   this.right = this.x + this.measurements.actualBoundingBoxRight
    //   this.top = this.y - this.measurements.actualBoundingBoxDescent
    //   this.bottom = this.y
    //   this.width = this.right - this.left;
    //   this.height = this.bottom - this.top;
    //   ctx.fillText(this.text, this.x, this.y);
    // }
  }
  this.save = function (dataToSave) {
    console.log("word: ", stimList[stimIdx].word)
    appendTrialDataToFile(currentFileHeader, fileToSave, dataToSave)
  }
}


function Paddle(x, y, width, height, color) {
  this.x = x
  this.y = y
  this.color = color
  this.width = width
  this.height = height
  this.left = this.x
  this.right = this.x + this.width
  this.top = this.y
  this.bottom = this.y + this.height
  this.speedX = 0;
  this.speedY = 0;
  this.draw = function() {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.width, this.height);
  }
  this.setPos = function(newX, newY) {
    this.x = newX
    this.y = newY
    this.left = this.x
    this.right = this.x + this.width
    this.top = this.y
    this.bottom = this.y + this.height
    //console.log("set new paddle pos")
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
  gameArea.clear()
  if (assessment === 'haatPhon') {
    ctx.font = '48px arial';
  } else if (assessment === 'haatSem') {
    ctx.font = '48px arial';
  } else if (assessment === 'haatSpatial') {
    ctx.font = '48px filledBlock';
  }
  drawText()
  updatePaddlePosition()
  paddle.draw()
  for (i = 0; i < allObstacles.length; i += 1) {
    var hit = 0
    if (paddle.crashWith(allObstacles[i])) {
      hit = 1
    }
    if (assessment === 'haatPhon') {
      // phonFileHeader = ['subj', 'runNum', 'sex', 'word', 'hit', 'freq', 'imagability', 'concreteness', 'meaning', 'posInWord', 'hasS', 'numLetters', 'numVows xxx', 'numCons xxx', 'rateOfFall', 'numSyl', 'isTarget', 'scrXpos', 'scrYpos xxx', 'mouseX xxx', 'mouseY xxx', 'dxFromMouse xxx', os.EOL]
      d = [subjID, sessID, sexID, stimList[stimIdx].word, hit, stimList[stimIdx].freq, stimList[stimIdx].imag, stimList[stimIdx].conc, stimList[stimIdx].meaning, stimList[stimIdx].posInWord, stimList[stimIdx].hasS, stimList[stimIdx].numLet, allObstacles[i].rateOfFall, stimList[stimIdx].numSyl, stimList[stimIdx].isTarget, i]
    } else if (assessment === 'haatSem') {
      //var semFileHeader = ['subj', 'runNum', 'sex', 'word', 'hit', 'numLetters', 'rateOfFall', 'numSyl', 'isTarget', 'scrXpos', os.EOL]
      d = [subjID, sessID, sexID, stimList[stimIdx].word, hit, stimList[stimIdx].numLet, allObstacles[i].rateOfFall, stimList[stimIdx].numSyl, stimList[stimIdx].isTarget, allObstacles[i].x]
    } else if (assessment === 'haatSpatial') {
      d = ['space', 1,2,3, 'space']
    }
    // if hit
    if (hit > 0) {
      allObstacles[i].save(d)
      stimIdx += 1
      if (stimIdx > numberOfStims) {
        stimIdx = 0
      }
      console.log("stimIdx: ", stimIdx)
      allObstacles[i].update(stimList[stimIdx].word, i, 0, 'black', getRandomInt(slowSpeed, fastSpeed))
    } else if (hit == 0 && allObstacles[i].y > canvas.height) {
      allObstacles[i].save(d)
      stimIdx += 1
      if (stimIdx > numberOfStims) {
        stimIdx = 0
      }
      allObstacles[i].update(stimList[stimIdx].word, i, 0, 'black', getRandomInt(slowSpeed, fastSpeed))
      console.log("stimIdx: ", stimIdx)
    }
  }
}


function startGame() {
    gameArea.start();
}


function updatePaddlePosition() {
    posx = mouseX - (paddle.width/2);
    posy = mouseY - (paddle.height/2);
    paddle.setPos(posx, posy)
}


function getMousePos(evt) {
    var rect = canvas.getBoundingClientRect();
    x = (evt.clientX - rect.left) / (rect.right - rect.left) * canvas.width
    y = (evt.clientY - rect.top) / (rect.bottom - rect.top) * canvas.height
    mouseX = x
    mouseY = y
}


function showSummary() {

}


function resetTrialNumber() {
  t = -1
}

// event listeners that are active for the life of the application
document.addEventListener('keyup', checkForEscape)
document.addEventListener('keyup', updateKeys)
window.addEventListener('mousemove', getMousePos, false);