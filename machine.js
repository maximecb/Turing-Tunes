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

// Memory actions
var ACTION_LEFT  = 0;
var ACTION_RIGHT = 1;

// Output actions
var OUT_WRITE = 0;
var OUT_NOOP  = 1;

/*
N states (one start state)
K memory symbols
S output symbols
2 memory actions
2 output actions

N x K -> N x K x S x 2 x 2
*/
function Machine(numStates, numSymbols, outSymbols, memSize)
{
    assert (
        numStates >= 1,
        'must have at least 1 state'
    );
    
    assert (
        numSymbols >= 1,
        'must have at least 1 memory symbol'
    );

    assert (
        outSymbols.length >= 1,
        'must have at least 1 output symbol'
    );

    assert (
        memSize >= 1,
        'must have at least 1 memory cell'
    );

    /// Number of states
    this.numStates = numStates;

    /// Number of memory symbols
    this.numSymbols = numSymbols;

    /// Number of outputs
    this.outSymbols = outSymbols;

    /// Transition table
    this.table = new Int32Array(numStates * numSymbols * 5);

    /// Memory tape
    this.memory = new Uint16Array(memSize);

    // Generate random transitions
    for (var st = 0; st < numStates; ++st)
    {
        for (var sy = 0; sy < numSymbols; ++sy)
        {
            var idx = this.getTransIdx(st, sy);
            this.table[idx + 0] = randomInt(0, numStates - 1);         // New state
            this.table[idx + 1] = randomInt(0, numSymbols - 1);        // Mem symbol
            this.table[idx + 2] = randomInt(0, outSymbols.length - 1); // Out symbol
            this.table[idx + 3] = randomInt(0, 1);                     // Mem action
            this.table[idx + 4] = randomInt(0, 1);                     // Out action
        }
    }

    // Initialize the state
    this.reset();
}

Machine.prototype.getTransIdx = function (st, sy)
{
    return (this.numStates * sy + st) * 5;
}

Machine.prototype.reset = function ()
{
    /// Start state
    this.state = 0;

    /// Memory position
    this.memPos = 0;

    // Initialize the memory tape
    for (var i = 0; i < this.memory.length; ++i)
        this.memory[i] = 0;

    /// Iteration count
    this.itrCount = 0;
}

Machine.prototype.toString = function ()
{
    var str = '';

    str += this.outSymbols.length;
    for (var i = 0; i < this.outSymbols.length; ++i)
    {
        var sym = this.outSymbols[i];
        str += ',' + sym.note;
        str += ',' + sym.frac;
        str += ',' + ((sym.drumNote !== null)? sym.drumNote:'');
    }
    str += ',';

    str += this.numStates + ',' + this.numSymbols + ',' + this.memory.length;
    for (var i = 0; i < this.table.length; ++i)
    {
        str += ',' + this.table[i];
    }

    //print(str);

    return str;
}

Machine.fromString = function (str)
{
    function extract()
    {
        var subStr = str.split(',', 1)[0];
        str = str.substr(subStr.length+1);
        return subStr;
    }

    print('str: ' + str);

    var numSymbols = parseInt(extract());

    print('numSymbols: ' + numSymbols);

    var outSymbols = new Array(numSymbols);
    for (var i = 0; i < outSymbols.length; ++i)
    {
        var note = extract();
        var frac = extract();
        var drumNote = extract();

        //print(i + ' / ' + outSymbols.length);

        outSymbols[i] = {
            note: Note(note),
            frac: parseFloat(frac),
            drumNote: drumNote? parseInt(drumNote):null
        };

        print(outSymbols[i].frac);
    }

    var numStates  = parseInt(extract());
    var numSymbols = parseInt(extract());
    var memSize    = parseInt(extract());

    var machine = new Machine(
        numStates, 
        numSymbols,
        outSymbols,
        memSize
    );

    for (var i = 0; i < machine.table.length; ++i)
        machine.table[i] = parseInt(extract());

    return machine;
}

/**
Perform one update iteration
*/
Machine.prototype.iterate = function()
{
    var idx = this.getTransIdx(this.state, this.memory[this.memPos]);
    var st = this.table[idx + 0];
    var ms = this.table[idx + 1];
    var os = this.table[idx + 2];
    var ma = this.table[idx + 3];
    var oa = this.table[idx + 4];

    // Update the current state
    this.state = st;

    // Write the new symbol to the memory tape
    this.memory[this.memPos] = ms;

    assert (
        this.state >= 0 && this.state < this.numStates,
        'invalid state'
    );

    assert (
        os >= 0 && os < this.outSymbols.length,
        'invalid output symbol'
    );

    // Perform the memory action
    switch (ma)
    {
        case ACTION_LEFT:
        this.memPos += 1;
        if (this.memPos >= this.memory.length)
            this.memPos -= this.memory.length;
        break;

        case ACTION_RIGHT:
        this.memPos -= 1;
        if (this.memPos < 0)
            this.memPos += this.memory.length;
        break;

        default:
        error('invalid memory action');
    }

    assert (
        this.memPos >= 0 && this.memPos < this.memory.length,
        'invalid memory position'
    );

    var output;

    // Perform the output action
    switch (oa)
    {
        case OUT_WRITE:
        output = this.outSymbols[os];
        break;

        case OUT_NOOP:
        output = null;
        break;

        default:
        error('invalid output action');
    }

    ++this.itrCount;

    return output;
}

