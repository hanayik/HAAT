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
var hapticjs = require('hapticjs')
var ipcRenderer = require('electron').ipcRenderer;
var _ = require('lodash');
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
var spaceFileHeader = ['subj', 'runNum', 'sex', 'word', 'hit', 'numLetters', 'rateOfFall', 'isTarget', 'scrXpos', os.EOL]
var currentFileHeader
var subjID
var sessID
var sexID
var userDataPath = path.join(app.getPath('userData'),'Data')
makeSureUserDataFolderIsThere()
var savePath
var taskTimeout
var taskTimeoutTime = 120000 // 120 sec (2 min) = 120,000 ms
var haatPhonStim = readCSV(path.resolve(exp.mediapath, 'HAATstimsPhon.csv'))
var haatSemStim = readCSV(path.resolve(exp.mediapath, 'HAATstimsSem.csv'))
var haatSpatialStim = readCSV(path.resolve(exp.mediapath, 'HAATstimsSpatial.csv'))
var haatPhonInstructions = ["<h1>You will see words falling from the top of the screen. <br>" +
                    "Your goal is to use the mouse to hit the target words. <br>" +
                    "The target words are words that have the 's' sound. <br>" +
                    "BUT, not all words with the letter 's' make the correct sound. <br>" +
                    "Try to be as accurate as possible! </h1>"]
var haatSemInstructions = ["<h1>You will see words falling from the top of the screen. <br>" +
                    "Your goal is to use the mouse to hit the target words. <br>" +
                    "The target words are words that name animals. <br>" +
                    "Try to be as accurate as possible! </h1>"]
var haatSpatialInstructions = ["<h1>You will see shapes falling from the top of the screen. <br>" +
                    "Your goal is to use the mouse to hit the target shape. <br>" +
                    "Try to be as accurate as possible! <br>" +
                    "Your target is below. </h1><br>"]
var haatSpatialTargetShape = "laall"
var canvas = document.getElementById('canvas')
var ctx = canvas.getContext('2d')
var font = new FontFaceObserver('customBlock');
font.load().then(function () {
  console.log('*** custom font loaded ***');
  canvas.style.fontFamily = 'customBlock'
  canvas.style.cursor = "auto"
  ctx.font = '48px customBlock'
});
var nCols = 4
var textColumns = []
var paddle = new Paddle(500, 500, 100, 20, "black");
var mouseX = 0
var mouseY = 0
var word1 = new textComponent('one', textColumns[0], 0, 'black')
var word2 = new textComponent('two', textColumns[1], 0, 'black')
var word3 = new textComponent('three', textColumns[2], 0, 'black')
var word4 = new textComponent('four', textColumns[3], 0, 'black')
var allObstacles = []
var slowSpeed = 2
var fastSpeed = 5
var stimIdx
var stimList
var isFirstCycle = true
var numberOfStims
var d
var gameArea = {
  canvas : canvas,
  ctx : ctx,
  clear : function() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  },
  stop : function() {
    clearInterval(this.interval);
    clearTimeout(taskTimeout)
  },
  start : function() {
    stimIdx = 4
    this.interval = setInterval(updateGameArea, 16);
    textColumns = numeric.linspace(0, canvas.width, nCols+2)
    textColumns = textColumns.slice(1,textColumns.length - 1)
    textColumns = textColumns.map(element => element - (Math.round(textColumns[0]/3)));
    taskTimeout = setTimeout(function () {
      canvas.style.cursor = "auto"
      stopGameAndOpenNav()
    }, taskTimeoutTime)
  }
}

function checkForUpdateFromRender() {
  ipcRenderer.send('user-requests-update')
  //alert('checked for update')
}

ipcRenderer.on('showSpinner', function () {
  //<div class="loader">Loading...</div>
  spinnerDiv = document.createElement('div')
  spinnerDiv.className = 'loader'
  spinnerDiv.style.zIndex = "1000";
  content.appendChild(spinnerDiv)
  console.log("added spinner!")

})





function getSubjID() {
  var subjID = document.getElementById("subjID").value.trim()
  if (subjID === '') {
    subjID = '0'
  }
  return subjID
}

function getSessID() {
  var sessID = document.getElementById("sessID").value.trim()
  if (sessID === '') {
    sessID = '0'
  }
  return sessID
}

function getSexID() {
  var sexID = document.getElementById("sexID").value.trim()
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
    {title: "HAAT Analysis",
    defaultPath: savePath,
    properties: ["openFile"]},
  analyzeSelectedFile)
}


function analyzeSelectedFile(theChosenOne) {
  filePath = theChosenOne[0]
  console.log("file chosen: ", filePath)
  data = readCSV(filePath)
  filteredData = _.filter(data, function(v) { return v.subj!==""; });
  console.log(filteredData)
  len = filteredData.length
  console.log("number of data points: ", len)
  onlyHits = _.filter(filteredData, {'hit': "1" }).length;
  onlyTargs = _.filter(filteredData, {'isTarget': "1" }).length;
  targsHit = _.filter(filteredData, {'hit': "1", 'isTarget': "1" }).length;
  hitAcc = _.round((targsHit/onlyHits)*100, 2);
  totalAcc = _.round((targsHit/onlyTargs)*100, 2);
  totalNumOfStimuli = len;
  console.log("only hits: ", onlyHits)
  console.log("only targs: ", onlyTargs)
  console.log("targs hit: ", targsHit)
  console.log("hit acc: ", hitAcc)
  console.log("total acc: ", totalAcc)
  console.log("total num of stim: ", totalNumOfStimuli)
  alert("Accuracy score: " + totalAcc.toString() + "%")

  // var textDiv = document.createElement("div")
  // textDiv.style.textAlign = 'center'
  // // total acc
  // var totacc_p = document.createElement("p")
  // var totacc_txt = document.createTextNode("Accuracy score: " + totalAcc.toString())
  // totacc_p.appendChild(totacc_txt)
  // textDiv.appendChild(totacc_p)
  //
  // var accOverlayDiv = document.createElement("div")
  // accOverlayDiv.id = "accOverlayDiv"
  // accOverlayDiv.style.textAlign = 'center'
  // accOverlayDiv.style.position = "absolute"
  // accOverlayDiv.style.zIndex = 1000
  // accOverlayDiv.appendChild(textDiv)
  // content.appendChild(accOverlayDiv)
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
  // itemToRemove = document.getElementById("accOverlayDiv")
  // content.removeChild(itemToRemove)
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
  // var txtNode = document.createTextNode(txt)
  // p.appendChild(txtNode)
  p.innerHTML = txt
  textDiv.appendChild(p)
  var lineBreak = document.createElement("br")
  var startBtnDiv = document.createElement("div")
  var startBtn = document.createElement("button")
  var startBtnTxt = document.createTextNode("Start")
  startBtn.appendChild(startBtnTxt)
  startBtn.className = "startBtn"
  startBtn.onclick = function() {
    content.removeChild(instOverlayDiv)
    setTimeout(function () {
      canvas.style.cursor = "none"
      gameArea.start()
    }, 1000) // wait 1 sec before starting game
  }
  startBtnDiv.appendChild(startBtn)
  var instOverlayDiv = document.createElement("div")
  instOverlayDiv.style.textAlign = 'center'
  instOverlayDiv.style.position = "absolute"
  instOverlayDiv.style.zIndex = 1000
  instOverlayDiv.appendChild(textDiv)
  instOverlayDiv.appendChild(lineBreak)
  instOverlayDiv.appendChild(startBtnDiv)
  instOverlayDiv.appendChild(lineBreak)
  content.appendChild(instOverlayDiv)
  return getTime()
}


function showInstructionsSpatial(txt) {
  //trialOrder = shuffle(randomArray)
  //totalAccArray = []
  clearScreen()
  var textDiv = document.createElement("div")
  textDiv.style.textAlign = 'center'
  var p = document.createElement("p")
  // var txtNode = document.createTextNode(txt)
  // p.appendChild(txtNode)
  p.innerHTML = txt
  textDiv.appendChild(p)
  var lineBreak = document.createElement("br")
  var startBtnDiv = document.createElement("div")
  var startBtn = document.createElement("button")
  var startBtnTxt = document.createTextNode("Start")
  startBtn.appendChild(startBtnTxt)
  startBtn.className = "startBtn"
  startBtn.onclick = function() {
    content.removeChild(instOverlayDiv)
    setTimeout(function () {
      canvas.style.cursor = "none"
      gameArea.start()
    }, 1000) // wait 1 sec before starting game
  }
  startBtnDiv.appendChild(startBtn)
  var instOverlayDiv = document.createElement("div")
  instOverlayDiv.style.textAlign = 'center'
  instOverlayDiv.style.position = "absolute"
  instOverlayDiv.style.zIndex = 1000
  instOverlayDiv.appendChild(textDiv)
  instOverlayDiv.appendChild(lineBreak)
  instOverlayDiv.appendChild(lineBreak)
  var targetShapeDiv = document.createElement("div")
  targetShapeDiv.style.fontFamily = 'customBlock'
  targetShapeDiv.style.fontSize = '40px'
  var targetShapeContents = document.createElement("p")
  var textContents = document.createTextNode(haatSpatialTargetShape)
  targetShapeContents.appendChild(textContents)
  targetShapeDiv.appendChild(targetShapeContents)
  instOverlayDiv.appendChild(targetShapeDiv)
  instOverlayDiv.appendChild(lineBreak)
  instOverlayDiv.appendChild(startBtnDiv)
  instOverlayDiv.appendChild(lineBreak)
  content.appendChild(instOverlayDiv)
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


// // update keys object when a keydown event is detected
// function updateKeys() {
//   // gets called from: document.addEventListener('keydown', updateKeys);
//   iti = 1500 // milliseconds
//   fbTime = 750
//   keys.key = event.key
//   keys.time = performance.now() // gives ms
//   keys.rt = 0
//   console.log("key: " + keys.key)
//   if (keys.key === '1' || keys.key === '2') {
//     if (!isPractice) {
//       clearScreen()
//       accuracy = checkAccuracy()
//       totalAccArray.push(accuracy)
//       totalAcc = mean(totalAccArray)
//       console.log('total acc: ', totalAcc)
//       console.log("accuracy: ", accuracy)
//       keys.rt = getRT()
//       console.log("RT: ", keys.rt)
//       showFeedback(accuracy)
//       setTimeout(clearScreen, fbTime)
//       //['subj', 'session', 'assessment', 'level', 'stim1', 'stim2', 'correctResp', 'keyPressed', 'reactionTime', 'accuracy', os.EOL]
//       //appendTrialDataToFile(fileToSave, [subjID, sessID, 'PhonTx', level, trials[trialOrder[t]].stim1.trim(), trials[trialOrder[t]].stim2.trim(), trials[trialOrder[t]].correctResp.trim(), keys.key, keys.rt, accuracy])
//       //waitSecs(1.5)
//       setTimeout(function() {showNextTrial(level)}, iti + fbTime)
//     } else if (isPractice) {
//       clearScreen()
//       accuracy = checkAccuracy()
//       totalAccArray.push(accuracy)
//       totalAcc = mean(totalAccArray)
//       console.log('total acc: ', totalAcc)
//       console.log("accuracy: ", accuracy)
//       keys.rt = getRT()
//       console.log("RT: ", keys.rt)
//       showFeedback(accuracy)
//       setTimeout(clearScreen, fbTime)
//       setTimeout(function() {showNextPracticeTrial(level)}, iti + fbTime)
//     }
//   } else if (keys.key === 'ArrowLeft') {
//
//   }
// }


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
    canvas.style.cursor = "auto"
    console.log("Escape was pressed")
    openNav()
    nav.hidden = false
    clearScreen()
    resetVars()
    gameArea.stop()
    gameArea.clear()

  }
}

function stopGameAndOpenNav() {
  openNav()
  nav.hidden = false
  clearScreen()
  resetVars()
  gameArea.stop()
  gameArea.clear()
  analyzeSelectedFile([fileToSave])
}


function resetVars() {

}

function getStarted() {
  // resetVars()
  subjID = document.getElementById("subjID").value.trim()
  sessID = document.getElementById("sessID").value.trim()
  sexID = document.getElementById("sexID").value.trim()
  assessment = document.getElementById("assessmentID").value.trim()
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
    //stimIdx = -1
    if (assessment === 'haatPhon') {
      stimList = shuffle(haatPhonStim)
      currentFileHeader = phonFileHeader
      showInstructions(haatPhonInstructions)
      dir = path.join(savePath, 'HAATPhon', getSubjID(), getSessID())
      if (!fs.existsSync(dir)) {
          mkdirp.sync(dir)
        }
      fileToSave = path.join(dir,subjID+'_'+sessID+'_'+assessment+'_'+getDateStamp()+'.csv')
    } else if (assessment === 'haatSem') {
      stimList = shuffle(haatSemStim)
      currentFileHeader = semFileHeader
      showInstructions(haatSemInstructions)
      dir = path.join(savePath, 'HAATSem', getSubjID(), getSessID())
      if (!fs.existsSync(dir)) {
          mkdirp.sync(dir)
        }
      fileToSave = path.join(dir,subjID+'_'+sessID+'_'+assessment+'_'+getDateStamp()+'.csv')
    } else if (assessment === 'haatSpace') {
      stimList = shuffle(haatSpatialStim)
      currentFileHeader = spaceFileHeader
      showInstructionsSpatial(haatSpatialInstructions)
      dir = path.join(savePath, 'HAATSpatial', getSubjID(), getSessID())
      if (!fs.existsSync(dir)) {
          mkdirp.sync(dir)
        }
      fileToSave = path.join(dir,subjID+'_'+sessID+'_'+assessment+'_'+getDateStamp()+'.csv')
    }
    word1.update(0, stimList[0].word, textColumns[0], 0, 'black', getRandomInt(slowSpeed,fastSpeed))
    word2.update(1, stimList[1].word, textColumns[1], 0, 'black', getRandomInt(slowSpeed,fastSpeed))
    word3.update(2, stimList[2].word, textColumns[2], 0, 'black', getRandomInt(slowSpeed,fastSpeed))
    word4.update(3, stimList[3].word, textColumns[3], 0, 'black', getRandomInt(slowSpeed,fastSpeed))
    numberOfStims = stimList.length-1
    //stimIdx = 4
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
  this.listIdx = 0
  this.update = function(listIdx, newText, colIdx, newY, newColor, rateOfFall) {
    if (listIdx === undefined) {
      listIdx = 0
    }
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
    this.listIdx = listIdx
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
  } else if (assessment === 'haatSpace') {
    ctx.font = '48px customBlock';
  }
  drawText()
  updatePaddlePosition()
  paddle.draw()
  for (i = 0; i < allObstacles.length; i++) {
    hit = 0
    d = []
    if (paddle.crashWith(allObstacles[i])) {
      hit = 1
      hapticjs.vibrate()
    }
    var objIdx = allObstacles[i].listIdx
    if (assessment === 'haatPhon') {
      // phonFileHeader = ['subj', 'runNum', 'sex', 'word', 'hit', 'freq', 'imagability', 'concreteness', 'meaning', 'posInWord', 'hasS', 'numLetters', 'numVows xxx', 'numCons xxx', 'rateOfFall', 'numSyl', 'isTarget', 'scrXpos', 'scrYpos xxx', 'mouseX xxx', 'mouseY xxx', 'dxFromMouse xxx', os.EOL]
      d = [subjID, sessID, sexID, stimList[objIdx].word, hit, stimList[objIdx].freq, stimList[objIdx].imag, stimList[objIdx].conc, stimList[objIdx].meaning, stimList[objIdx].posInWord, stimList[objIdx].hasS, stimList[objIdx].numLet, allObstacles[i].rateOfFall, stimList[objIdx].numSyl, stimList[objIdx].isTarget, allObstacles[i].x]

    } else if (assessment === 'haatSem') {
      //var semFileHeader = ['subj', 'runNum', 'sex', 'word', 'hit', 'numLetters', 'rateOfFall', 'numSyl', 'isTarget', 'scrXpos', os.EOL]
      d = [subjID, sessID, sexID, stimList[objIdx].word, hit, stimList[objIdx].numLet, allObstacles[i].rateOfFall, stimList[objIdx].numSyl, stimList[objIdx].isTarget, allObstacles[i].x]

    } else if (assessment === 'haatSpace') {
      d = [subjID, sessID, sexID, stimList[objIdx].word, hit, stimList[objIdx].word.length, allObstacles[i].rateOfFall, stimList[objIdx].isTarget, allObstacles[i].x]

    }
    // if hit
    if (hit > 0) {
      allObstacles[i].save(d)
      console.log("word: ", stimList[objIdx].word)
      stimIdx++
      if (stimIdx > numberOfStims) {
        stimIdx = 0
      }
      allObstacles[i].listIdx = stimIdx
      console.log("stimIdx: ", stimIdx)
      allObstacles[i].update(stimIdx, stimList[stimIdx].word, i, 0, 'black', getRandomInt(slowSpeed, fastSpeed))
    } else if (hit == 0 && allObstacles[i].y > canvas.height) {
      allObstacles[i].save(d)
      console.log("word: ", stimList[objIdx].word)
      stimIdx++
      if (stimIdx > numberOfStims) {
        stimIdx = 0
      }
      allObstacles[i].listIdx = stimIdx
      allObstacles[i].update(stimIdx, stimList[stimIdx].word, i, 0, 'black', getRandomInt(slowSpeed, fastSpeed))
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
window.addEventListener('mousemove', getMousePos, false);
