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

    // TODO
    //for (var i = 0; i < this.table.length; ++i)
    //    str += ',' + this.table[i];

    return str;
}

Machine.fromString = function (str)
{
    // TODO
    /*
    console.log(str);

    var nums = str.split(',').map(Number);

    numStates  = nums[0];
    numSymbols = nums[1];

    console.log('num states: ' + numStates);
    console.log('num symbols: ' + numSymbols);

    assert (
        numStates > 0 &&
        numSymbols > 0,
        'invalid input string'
    );

    var prog = new Machine(numStates, numSymbols, mapWidth, mapHeight);

    assert (
        prog.table.length === nums.length - 2,
        'invalid transition table length'
    );

    for (var i = 0; i < prog.table.length; ++i)
        prog.table[i] = nums[i+2];

    return prog;
    */
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

