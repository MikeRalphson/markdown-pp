var fs = require('fs');
var path = require('path');

var fetch = require('./fetch.js');

var inFlight = 0;
var toc = [];
var ref = [];
var refpos = -1;
var tocpos = -1;

function slug(s) {
    return s.toLowerCase().split(' ').join('');
}

function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function writeFile(outfile,out) {
    fs.writeFile(outfile,out.join('\n'),'utf8');
}

function process(s,outfile,out,state,callback) {
   var lines = s.split('\r').join('').split('\n');
   if (refpos > state.outpos) {
       refpos += lines.length;
   }
   for (var l=0;l<lines.length;l++) {
       var line = lines[l];
       if (line.startsWith('!TOC')) {
           tocpos = state.outpos;
           line = undefined;
       }
       if (line && line.startsWith('!REF')) {
           refpos = state.outpos;
           line = undefined;
       }
       if (line && line.startsWith('!INCLUDE ')) {
           var components = line.match(/^\!INCLUDE \"(.+)\"/);
           if (components) {
               var includeFile = path.resolve(components[1]);
               var include = fs.readFileSync(includeFile,'utf8').split('\r').join('').split('\n');
               lines = lines.slice(0, l).concat(include).concat(lines.slice(l+1));
               line = lines[l];
           }
       }
       if (line && line.startsWith('!INCLUDEURL ')) {
           var components = line.match(/^\!INCLUDEURL \"(.+)\"/);
           if (components) {
               inFlight++;
               var url = components[1];
               fetch.get(url,{},clone(state),function(err, resp, body, newState) {
                   if (!err) {
                       var include = process(body,outfile,out,newState,writeFile);
                   }
               });
               line = undefined;
           }
       }
       if (line && (line.startsWith('---')) && (l>0)) {
           var anchor = '<a name="'+slug(lines[l-1].split('#').join(''))+'"></a>';
           out.splice(state.outpos-1,0,anchor);
           state.outpos++;
           state.headings[0]++;
           out.splice(state.outpos-1,0,'');
           state.outpos++;
           toc.splice(0,0,state.headings[0]+'\\.  ['+out[out.length-1]+'](#'+slug(out[out.length-1])+')  ');
           out[out.length-1] = state.headings[0]+'\\. '+out[out.length-1];
       }
       if (line && line.match(/^\#+/)) {
           var level = -1;
           var newline = line;
           var prefix = '';
           while (newline.startsWith('#')) {
               newline = newline.substr(1);
               prefix += '#';
               level++;
           }
           while (state.headings.length<level) {
               state.headings.push(0);
           }
           while (state.headings.length>level) {
               state.headings.pop();
           }
           state.headings[state.headings.length-1] += 1;
           newline = newline.trim();
           var anchor = '<a name="'+slug(newline.split('#').join(''))+'"></a>';
           var heading = '';
           for (var h of state.headings) {
               heading += (heading ? '.' : '')+h;
           }
           toc.splice(0,0,heading+'\\.  ['+newline+'](#'+slug(newline)+')  ');
           newline = prefix+' '+heading+'\\. '+newline;
           out.splice(state.outpos,0,newline);
           out.splice(state.outpos,0,'');
           out.splice(state.outpos,0,anchor);
           state.outpos += 3;
           line = undefined;
       }
       if (line && line.startsWith('!VIDEO')) {
           var components = line.split('/');
           var video = components[components.length-1].replace('"','').replace("'",'');
           line = '[![Link to Youtube video](http://img.youtube.com/vi/'+video+'/0.jpg)](http://www.youtube.com/watch?v='+video+')';
       }
       if (line && line.startsWith('$') && line.endsWith('$')) {
           line = line.substr(1,line.length-2);
           line = '![latex](https://chart.googleapis.com/chart?cht=tx&chl='+encodeURIComponent(line)+')';
       }
       if (line) {
           var rline = line.replace(/`.*`/,'``');
           var components = rline.match(/\[(.+)\]:\ (.+)\ \"(.*)\"/);
           if (components && !rline.startsWith('    ') && !rline.startsWith('\t')) {
               ref.splice(0,0,'*\t['+components[3]+']['+components[1]+']');
           }
       }

       if (typeof line !== 'undefined') {
           out.splice(state.outpos,0,line);
           state.outpos++;
       }
   }

   inFlight--;
   if (inFlight<=0) {
       if (tocpos >= 0) {
           for (var t of toc) {
               out.splice(tocpos,0,t);
           }
       }
       if (refpos >= 0) {
           for (var r of ref) {
               out.splice(refpos+toc.length,0,r);
           }
       }
       callback(outfile,out);
   }
   return out;
}

module.exports = {

    render: function(infile, outfile) {
        var state = {};
        inFlight = 1;
        state.outpos = 0;
        state.headings = [0];
        fs.readFile(infile,'utf8',function(err, s){
            process(s,outfile,[],state,writeFile);
        });
    }

};
