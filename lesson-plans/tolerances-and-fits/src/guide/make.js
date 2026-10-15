const fs = require('fs');
const path = require('path');   // run: NODE_PATH=$(npm root -g) node make.js   (needs the docx package)
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, LevelFormat, AlignmentType } = require('docx');
const F='Calibri', SZ=18;
const r=(t,o={})=>new TextRun({text:t,font:F,size:SZ,...o});
const B=t=>r(t,{bold:true});
const P=(kids,o={})=>new Paragraph({children:kids,spacing:{after:50,line:236},...o});
const H=t=>new Paragraph({children:[r(t,{bold:true,size:21,color:'1F4E79'})],spacing:{before:90,after:40}});
const bl=(kids)=>new Paragraph({children:kids,numbering:{reference:'b',level:0},spacing:{after:20,line:232}});
const W=[1700,8380], TW=W[0]+W[1];
const bd={style:BorderStyle.SINGLE,size:4,color:'BFC9D3'}, borders={top:bd,bottom:bd,left:bd,right:bd};
const cell=(kids,w,shade)=>new TableCell({children:[new Paragraph({children:kids,spacing:{after:0,line:226}})],width:{size:w,type:WidthType.DXA},borders,margins:{top:30,bottom:30,left:80,right:80},...(shade?{shading:{type:ShadingType.CLEAR,fill:shade,color:'auto'}}:{})});
const rows=[
 ['Section','What students do'],
 ['00 Plan','Teacher edition only: objectives, 90-minute agenda, key terms.'],
 ['01 Reading','Three ways to write a tolerance. Drag the limits on a ruler; "Match the drawing" gives practice targets.'],
 ['02 Inspector','Game: measure 10 parts with a caliper and accept or reject each. Scores bad parts shipped and good parts scrapped.'],
 ['03 Fit explorer','3D tab and slot. Presets, tightest/loosest cases, "Print a pair, then predict" whether it slides in.'],
 ['04 Fits','Drag the tab’s tolerance band to make a clearance, transition and interference fit.'],
 ['05 Stack-ups','Three blocks in a pocket: smallest and largest gap, random builds, 2,000-build histogram (RSS is Challenge).'],
 ['06 Practice','Step-by-step fit and stack-up problems; each step checked with a hint; unlimited random problems.'],
 ['07 3D printing','Watch a layer print (why holes come out small) and a slot build layer by layer; printed-fit predictor.'],
 ['08 Puzzle cube','3×3×3 cube of 0.750 in cubes, five pieces of 4–6 cubes. Set tolerances, assemble in 3D, print 50 cubes.'],
 ['09 Exit ticket','Three questions answered on paper (answers in the Teacher edition).'],
];
const table=new Table({width:{size:TW,type:WidthType.DXA},columnWidths:W,rows:rows.map((rw,i)=>new TableRow({children:[cell([r(rw[0],{bold:true})],W[0],i?null:'DCE6F0'),cell([r(rw[1],i?{}:{bold:true})],W[1],i?null:'DCE6F0')]}))});
const doc=new Document({numbering:{config:[{reference:'b',levels:[{level:0,format:LevelFormat.BULLET,text:'•',alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:300,hanging:200}}}}]}]},
 sections:[{properties:{page:{size:{width:12240,height:15840},margin:{top:720,bottom:640,left:1080,right:1080}}},children:[
  new Paragraph({children:[r('Tolerances, Fits & Stack-ups',{bold:true,size:30})],spacing:{after:0}}),
  new Paragraph({children:[r('Interactive lesson v5.0 · Quick guide for teachers · 9th grade · about 90 minutes · all sizes in inches',{color:'555555'})],border:{bottom:{style:BorderStyle.SINGLE,size:6,color:'1F4E79',space:3}},spacing:{after:80}}),
  H('The two files'),
  bl([B('Tolerances and Fits - Teacher.html: '),r('every activity plus the teacher plan, agenda and answer keys. Use it to plan and to project in class.')]),
  bl([B('Tolerances and Fits - Student.html: '),r('the same activities with the plan and answer keys removed from the file itself. Give this one to students.')]),
  bl([r('Each is a single standalone HTML file (about 0.7 MB). '),B('No install, no internet, no account: '),r('double-click to open in Chrome, Edge, Firefox or Safari, including on Chromebooks.')]),
  H('Getting started'),
  bl([B('Share: '),r('email the Student file, post it to your LMS, or copy it to a shared drive or USB stick. Students download it and double-click.')]),
  bl([B('Move around: '),r('the page shows one section at a time. Use the section bar at the top (back and forward arrows, or click a numbered section) or the large Next button at the end of each section. '),B('Show all'),r(' switches to one long page.')]),
  bl([B('3D models: '),r('drag to turn, scroll or pinch to zoom; the 3D / Front / Top buttons reset the view.')]),
  bl([B('Saved on each computer: '),r('the page remembers the last section, view mode, best Inspector score and practice progress in that browser. Nothing is sent anywhere.')]),
  H('What is in the lesson'),
  table,
  H('Teaching tips'),
  bl([r('Open with the hook: a printed 0.750 in tab that won’t go into a 0.750 in slot. Then use §03 "Naïve 3D print" to show why.')]),
  bl([r('Items tagged '),B('Challenge'),r(' (RSS, stack-up practice, the puzzle’s tolerance budget) are extension work for faster students or a second day.')]),
  bl([r('Debrief §02: which mistake costs more, shipping a bad part or scrapping a good one? Debrief §08: why every best answer has the same budget.')]),
  bl([r('Homework lab: print a clearance test coupon (§07), then print the puzzle cube with the class’s chosen tolerances.')]),
  bl([r('Keyboard works too: arrow keys move the ruler handles, the caliper jaw and the tab band; Shift moves farther.')]),
  H('If something goes wrong'),
  bl([B('3D view says it could not start: '),r('turn on hardware acceleration in the browser settings, or use another browser. The 2D drawings still work.')]),
  bl([B('A phone screen is small: '),r('the ruler and caliper drawings scroll sideways inside their cards. A laptop or Chromebook works best.')]),
 ]}]});
Packer.toBuffer(doc).then(b=>fs.writeFileSync(path.join(__dirname,'..','..','Tolerances and Fits - Quick Guide.docx'),b));
