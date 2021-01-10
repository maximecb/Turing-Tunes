/*****************************************************************************
*
*  This file is part of the Turing-Tunes project. The project is
*  distributed at:
*  https://github.com/maximecb/Turing-Tunes
*
*  Copyright (c) 2013, Maxime Chevalier-Boisvert. All rights reserved.
*
*  This software is licensed under the following license (Modified BSD
*  License):
*
*  Redistribution and use in source and binary forms, with or without
*  modification, are permitted provided that the following conditions are
*  met:
*   1. Redistributions of source code must retain the above copyright
*      notice, this list of conditions and the following disclaimer.
*   2. Redistributions in binary form must reproduce the above copyright
*      notice, this list of conditions and the following disclaimer in the
*      documentation and/or other materials provided with the distribution.
*   3. The name of the author may not be used to endorse or promote
*      products derived from this software without specific prior written
*      permission.
*
*  THIS SOFTWARE IS PROVIDED ``AS IS'' AND ANY EXPRESS OR IMPLIED
*  WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
*  MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN
*  NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT, INDIRECT,
*  INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT
*  NOT LIMITED TO PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
*  DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
*  THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
*  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
*  THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*
*****************************************************************************/

/**
Called after page load to initialize needed resources
*/
function init()
{
    // Initialize the form options
    initForm();

    // Get a reference to the canvas
    canvas = document.getElementById("canvas");

    // Get a 2D context for the drawing canvas
    canvas.ctx = canvas.getContext("2d");

    // Initialize the audio subsystem
    initAudio();

    // If a location hash is specified
    if (location.hash !== '')
    {
        console.log('parsing machine from hash string');

        // Extract the machine name
        var str = location.hash.substr(1);

        print(str);

        var args = str.split(',', 4);
        var name = args[0];
        piece.beatsPerMin = args[1];
        piece.beatsPerBar = args[2];
        piece.noteVal = args[3];
        str = str.substr(args.toString().length+1);

        setTitle(name);

        machine = Machine.fromString(str);

        playAudio();
    }
}
window.addEventListener("load", init, false);

/// Drum samples. These will get mapped to the note number
/// corresponding to their position in the list
var DRUM_SAMPLES = [
    { name: 'kick'  , path: 'samples/biab_trance_kick_4.wav'    , vol: 3 },
    { name: 'snare' , path: 'samples/biab_trance_snare_2.wav'   , vol: 1.5 },
    { name: 'hat 1' , path: 'samples/biab_trance_hat_6.wav'     , vol: 1.5 },
    { name: 'hat 2' , path: 'samples/closed_hat.wav'            , vol: 1.5 },
    { name: 'clap'  , path: 'samples/biab_trance_clap_2.wav'    , vol: 2 },
];

/// Maximum number of machine iterations to produce one note
var ITRS_PER_NOTE = 2000;

/// Web audio context
var audioCtx = undefined;

/// JS audio generation node
var jsAudioNode = undefined;

/// Audio generation event handler
var genAudio = undefined;

var drawInterv = undefined;

var piece = undefined;

var leadTrack = undefined;

var drumTrack = undefined;

var machine = undefined;

/**
Initialize the form options
*/
function initForm()
{
    var numStates = document.getElementById('numStates');
    for (var i = 5; i <= 25; ++i)
    {
        var opt = document.createElement("option");
        opt.text = String(i);
        opt.value = String(i);
        numStates.appendChild(opt);

        if (i === 10)
            opt.selected = true;
    }

    var numSymbols = document.getElementById('numSymbols');
    for (var i = 5; i <= 25; ++i)
    {
        var opt = document.createElement("option");
        opt.text = String(i);
        opt.value = String(i);
        numSymbols.appendChild(opt);

        if (i === 10)
            opt.selected = true;
    }

    var scaleRoot = document.getElementById('scaleRoot');
    for (var name in NOTE_NAME_PC)
    {
        var opt = document.createElement("option");
        opt.text = name;
        opt.value = name;
        scaleRoot.appendChild(opt);

        if (name === 'C')
            opt.selected = true;
    }

    var scaleType = document.getElementById('scaleType');
    for (var scale in scaleIntervs)
    {
        var opt = document.createElement("option");
        opt.text = scale;
        opt.value = scale;
        scaleType.appendChild(opt);

        if (scale == 'blues')
            opt.selected = true;
    }

    var drumSamples = document.getElementById('drumSamples');
    for (var i = 0; i < DRUM_SAMPLES.length; ++i)
    {
        var sample = DRUM_SAMPLES[i];

        var text = document.createTextNode(capitalize(sample.name));
        drumSamples.appendChild(text);

        var input = document.createElement("input");
        input.type = 'checkbox';
        input.value = String(i);
        drumSamples.appendChild(input);

        if (sample.name === 'kick')
            input.checked = true;
    }
}

/**
Initialize the audio subsystem
*/
function initAudio()
{
    // Create an audio context
    if (this.hasOwnProperty('AudioContext') === true)
    {
        //console.log('Audio context found');
        audioCtx = new AudioContext();
    }
    else if (this.hasOwnProperty('webkitAudioContext') === true)
    {
        //console.log('WebKit audio context found');
        audioCtx = new webkitAudioContext();
    }
    else
    {
        audioCtx = undefined;
    }

    // If no audio context was created
    if (audioCtx === undefined)
    {
        error(
            'No Web Audio API support. Sound will be disabled. ' +
            'Try this page in the latest version of Chrome'
        );
    }

    // Get the sample rate for the audio context
    var sampleRate = audioCtx.sampleRate;

    // Create the audio graph
    var graph = new AudioGraph(sampleRate);

    // Create a stereo sound output node
    var outNode = new OutNode(2);
    graph.setOutNode(outNode);

    // Create the piece
    piece = new Piece(graph);

    // Lead patch
    var lead = new VAnalog(2);
    lead.name = 'lead';
    lead.oscs[0].type = 'pulse';
    lead.oscs[0].duty = 0.5;
    lead.oscs[0].detune = -1195;
    lead.oscs[0].volume = 1;
    lead.oscs[0].env.a = 0;
    lead.oscs[0].env.d = 0.1;
    lead.oscs[0].env.s = 0.1;
    lead.oscs[0].env.r = 0.1;

    lead.oscs[1].type = 'pulse';
    lead.oscs[1].duty = 0.5;
    lead.oscs[1].detune = -1205;
    lead.oscs[1].volume = 1;
    lead.oscs[1].env = lead.oscs[0].env;

    lead.cutoff = 0.3;
    lead.resonance = 0;
    lead.filterEnv.a = 0;
    lead.filterEnv.d = 0.2;
    lead.filterEnv.s = 0.0;
    lead.filterEnv.r = 0;
    lead.filterEnvAmt = 0.85;

    // Drum kit
    var drumKit = new SampleKit();

    // Load the drum samples
    for (var i = 0; i < DRUM_SAMPLES.length; ++i)
    {
        var sample = DRUM_SAMPLES[i];
        drumKit.mapSample(Note(i), sample.path, sample.vol);
    }

    // Mixer with 8 channels
    mixer = new Mixer(8);
    mixer.inVolume[0] = 1.0;
    mixer.inVolume[1] = 1.0;
    mixer.outVolume = 0.5;

    // Connect all synth nodes and topologically order them
    lead.output.connect(mixer.input0);
    drumKit.output.connect(mixer.input1);
    mixer.output.connect(outNode.signal);

    // Create new tracks for the instruments
    leadTrack = piece.addTrack(new Track(lead));
    drumTrack = piece.addTrack(new Track(drumKit));

    // Order the audio graph nodes
    graph.orderNodes();

    // Create an audio generation event handler
    genAudio = piece.makeHandler();
}

/**
Generate a new random machine
*/
function genMachine()
{
    // Get the machine options
    var numStates = parseInt(document.getElementById("numStates").value);
    var numSymbols = parseInt(document.getElementById("numSymbols").value);
    var filterDuds = document.getElementById("filterDuds").checked;

    // Extract the scale root note
    var rootElem = document.getElementById('scaleRoot');
    var scaleRoot = undefined;
    for (var i = 0; i < rootElem.length; ++i)
    {
        if (rootElem[i].selected === true)
        {
            var scaleRoot = String(rootElem[i].value);
            break;
        }
    }

    if (NOTE_NAME_PC.hasOwnProperty(scaleRoot) === false)
        error('Invalid scale root');

    // Extract the scale type
    var typeElem = document.getElementById('scaleType');
    var scaleType = undefined;
    for (var i = 0; i < typeElem.length; ++i)
    {
        if (typeElem[i].selected === true)
        {
            var scaleType = String(typeElem[i].value);
            break;
        }
    }

    if (scaleIntervs[scaleType] === undefined)
        error('Invalid scale type');

    // Extract a list of octaves covered
    var octavesElem = document.getElementById('octaves');
    var octaves = [];
    for (var i = 0; i < octavesElem.children.length; ++i)
    {
        var octElem = octavesElem.children[i];
        if (octElem.checked === true)
            octaves.push(parseInt(octElem.value));
    }

    if (octaves.length === 0)
        error('Must cover at least one octave');

    // Extract a list of note durations
    var durationsElem = document.getElementById('durations');
    var durations = [];
    for (var i = 0; i < durationsElem.children.length; ++i)
    {
        var durElem = durationsElem.children[i];
        if (durElem.checked === true)
            durations.push(parseInt(durElem.value));
    }

    if (durations.length === 0)
        error('Must allow at least one note duration');

    // Extract a list of drum samples
    var drumsElem = document.getElementById('drumSamples');
    var drumNotes = [null];
    for (var i = 0; i < drumsElem.children.length; ++i)
    {
        var elem = drumsElem.children[i];
        if (elem.checked === true)
            drumNotes.push(parseInt(elem.value));
    }

    // Get the tempo and time signature
    var tempo = parseInt(document.getElementById("tempo").value);
    var timeSigNum = parseInt(document.getElementById("timeSigNum").value);
    var timeSigDenom = parseInt(document.getElementById("timeSigDenom").value);

    if (!(tempo > 0 && tempo <= 400))
        error('invalid tempo')
    if (!(timeSigNum > 0 && timeSigNum <= 32) &&
        !(timeSigDenom > 0 && timeSigDenom <= 32))
        error('invalid time signature');

    // Generate the list of scale notes
    var noteList = [];
    for (var i = 0; i < octaves.length; ++i)
    {
        var octNo = octaves[i];
        var octRoot = Note(scaleRoot + octNo);
        var scaleNotes = genScale(octRoot, scaleType);

        if (i + 1 < octaves.length && octaves[i+1] == octNo + 1)
            scaleNotes.pop();

        noteList = noteList.concat(scaleNotes)
    }

    // Generate the list of note value pairs
    var noteVals = [];
    for (var i = 0; i < noteList.length; ++i)
    {
        var note = noteList[i];

        for (var j = 0; j < durations.length; ++j)
        {
            var dur = durations[j];
            var noteFrac = timeSigDenom * (1 / dur);

            for (var k = 0; k < drumNotes.length; ++k)
            {
                var drumNote = drumNotes[k];
                noteVals.push({ note:note, frac:noteFrac, drumNote:drumNote });
            }
        }
    }

    // Set the timing configuration
    piece.beatsPerMin = tempo;
    piece.beatsPerBar = timeSigNum;
    piece.noteVal = timeSigDenom;

    console.log('num states: ' + numStates);
    console.log('num symbols: ' + numSymbols);
    console.log('Note list: ' + noteList.toString());
    console.log('Num output symbols: ' + noteVals.length);

    for (var attemptNo = 1; attemptNo < 50; attemptNo++)
    {
        console.log('Attempt #' + attemptNo);

        // Create a new random machine
        machine = new Machine(
            numStates,
            numSymbols,
            noteVals,       // Output symbols
            50000           // Memory size
        );

        var filter = testMachine(machine);

        if (filterDuds === false || filter === true)
            break;
    }

    // Clear the current hash tag to avoid confusion
    location.hash = '';

    // Clear the name from the page title
    setTitle('');

    // Start playing audio
    playAudio();
}

/**
Test the fitness of a machine
*/
function testMachine(machine)
{
    var NUM_TEST_ITRS = 20 * ITRS_PER_NOTE;

    var MAX_LOOP_LEN = 20;
    var NUM_LOOP_REPEATS = 5;

    // Generate output for a large number of iterations
    var notes = [];
    for (var i = 0; i < NUM_TEST_ITRS; ++i)
    {
        outSym = machine.iterate();
        if (outSym !== null)
            notes.push(outSym);
    }

    // If too few notes were generated, filter out
    if (notes.length < NUM_TEST_ITRS / ITRS_PER_NOTE)
        return false;

    // Test for loops
    LOOP_TEST:
    for (var loopLen = 2; loopLen < MAX_LOOP_LEN; ++loopLen)
    {
        for (var ofs = 0; ofs < MAX_LOOP_LEN; ++ofs)
        {
            var loopIdx = notes.length - loopLen - ofs;

            for (var i = 0; i < NUM_LOOP_REPEATS; ++i)
            {
                var loopIdx2 = loopIdx - (i+1) * loopLen;

                for (var j = 0; j < loopLen; ++j)
                    if (notes[loopIdx2 + j] !== notes[loopIdx+j])
                        continue LOOP_TEST;
            }
        }

        console.log("LOOP FOUND!!!!!!!!!!!");

        // Loop found
        return false;
    }

    // Filter test passed
    return true;
}

function playAudio()
{
    console.log('playAudio()');

    // Size of the audio generation buffer
    var bufferSize = 2048;

    // If audio is disabled, stop
    if (audioCtx === undefined)
        return;

    // If the audio isn't stopped, stop it
    if (jsAudioNode !== undefined)
        stopAudio()

    audioCtx.resume().then(function ()
    {
        // Reset the machine state
        machine.reset();

        // Clear the instrument tracks
        leadTrack.clear();
        drumTrack.clear();

        // Set the playback time on the piece to 0 (start)
        piece.setTime(0);

        var nextNoteBeat = 0;

        console.log('first beat time: ' + piece.beatTime(nextNoteBeat));

        function audioCB(evt)
        {
            // Generate audio data
            genAudio(evt);

            for (var i = 0; i < ITRS_PER_NOTE; ++i)
            {
                if (piece.beatTime(nextNoteBeat) > piece.playTime + 1)
                    return;

                outSym = machine.iterate();

                if (outSym === null)
                    continue;

                piece.makeNote(leadTrack, nextNoteBeat, outSym.note, outSym.frac);

                if (outSym.drumNote !== null)
                    piece.makeNote(drumTrack, nextNoteBeat, outSym.drumNote, outSym.frac);

                nextNoteBeat += piece.noteLen(outSym.frac);

                //console.log('mem pos: ' + machine.memPos);
                //console.log('itr count: ' + machine.itrCount);
                //console.log('next note beat: ' + nextNoteBeat);
            }
        }

        // Create a JS audio node and connect it to the destination
        jsAudioNode = audioCtx.createScriptProcessor(bufferSize, 2, 2);
        jsAudioNode.onaudioprocess = audioCB;
        jsAudioNode.connect(audioCtx.destination);
    });
}

function stopAudio()
{
    console.log('stopAudio()');

    // If audio is disabled, stop
    if (audioCtx === undefined)
        return;

    if (jsAudioNode === undefined)
        return;

    // Notify the piece that we are stopping playback
    piece.stop();

    // Disconnect the audio node
    jsAudioNode.disconnect();
    jsAudioNode = undefined;
}

/**
Restart the audio playback from the start
*/
function restartAudio()
{
    stopAudio();
    playAudio();
}

/**
Set the tune name in the page title
*/
function setTitle(name)
{
    var titleHeader = document.getElementById('titleHeader');
    while (titleHeader.childNodes.length > 1)
        titleHeader.removeChild(titleHeader.lastChild);

    var pageTitle = document.getElementById('pageTitle');
    while (pageTitle.childNodes.length > 1)
        pageTitle.removeChild(pageTitle.firstChild);

    if (name)
    {
        titleHeader.appendChild(document.createTextNode(' - ' + name));
        pageTitle.insertBefore(document.createTextNode(name + ' - '), pageTitle.firstChild);
    }
}

/**
Validate a name string
*/
function validName(name)
{
    return (
        name.length <= 40 &&
        /^[\w ]+$/.test(name)
    );
}

/**
Generate a shareable URL for the current piece
*/
function genURL()
{
    if (machine === undefined)
        error('need to generate a machine before sharing it');

    var name = document.getElementById('shareName').value;
    if (name.length === 0)
        error('Please enter a name for your creation');
    if (validName(name) === false)
        error('Invalid name');

    // Generate the encoding string
    var coding = '';
    coding += name + ',';
    coding += piece.beatsPerMin + ',';
    coding += piece.beatsPerBar + ',';
    coding += piece.noteVal + ',';
    coding += machine.toString();

    // Set the sharing URL
    var shareURL = (
        location.protocol + '//' + location.host +
        location.pathname + '#' + coding
    );
    document.getElementById("shareURL").value = shareURL;

    // Set the page title
    setTitle(name);
}
