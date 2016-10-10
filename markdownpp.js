var markdownpp = require('./index.js');

if (process.argv.length < 3) {
    console.log('Usage: markdownpp {infile} [outfile]');
}
else {
    var infile = process.argv[2];
    var outfile;
    if (process.argv.length > 3) {
        console.log(process.argv.length);
        outfile = process.argv[3];
    }
    else {
        outfile = infile.replace('.mdpp','.md');
        if (outfile === infile) {
            outfile = infile + '.md';
        }
    }
    markdownpp.render(infile,outfile);
}