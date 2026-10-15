const fs = require('fs');
const path = require('path');   // run: NODE_PATH=$(npm root -g) node make.js   (needs the docx package)
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, LevelFormat, AlignmentType, Footer, PageNumber, ImageRun } = require('docx');
const F='Calibri', SZ=20, ACC='0B7285';
const r=(t,o={})=>new TextRun({text:t,font:F,size:SZ,...o});
const B=t=>r(t,{bold:true});
const H=(t,first)=>new Paragraph({children:[r(t,{bold:true,size:22,color:ACC})],spacing:{before:first?40:120,after:40},keepNext:true});
const P=kids=>new Paragraph({children:kids,spacing:{after:50,line:244}});
const bl=kids=>new Paragraph({children:kids,numbering:{reference:'b',level:0},spacing:{after:20,line:244}});
const TW=10240;
const bd={style:BorderStyle.SINGLE,size:4,color:'BFC9D3'},borders={top:bd,bottom:bd,left:bd,right:bd};
const cell=(t,w,head,bold)=>new TableCell({children:[new Paragraph({children:[r(t,{bold:head||bold})],spacing:{after:0,line:228}})],width:{size:w,type:WidthType.DXA},borders,margins:{top:25,bottom:25,left:80,right:80},...(head?{shading:{type:ShadingType.CLEAR,fill:'D5EEF1',color:'auto'}}:{})});
const table=(W,rows)=>new Table({width:{size:TW,type:WidthType.DXA},columnWidths:W,rows:rows.map((rw,i)=>new TableRow({cantSplit:true,tableHeader:i===0,children:rw.map((c,j)=>cell(c,W[j],i===0,j===0))}))});
const IMG=(f,w,h,cap)=>[new Paragraph({alignment:AlignmentType.CENTER,keepNext:true,spacing:{before:60,after:20},children:[new ImageRun({type:'png',data:fs.readFileSync(path.join(__dirname,f)),transformation:{width:w,height:h}})]}),new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:70},children:[r(cap,{italics:true,size:18,color:'666666'})]})];

const sections=table([2050,8190],[
 ['Section','What students do'],
 ['00 Plan','Teacher edition only: objectives, 90-minute agenda, key terms.'],
 ['01 Meet the machine','CAD → CAM → G-code → CNC. Jog a 3D CNC mill with X, Y and Z buttons to three target points; meet the tools; 3-question check.'],
 ['02 Read the drawing','Pick one of four parts (Keychain tag, Motor mount plate, Bottle opener, Gear hub) and a material (wax, HDPE, aluminum). Read its drawing and dimension table; 2 drawing questions; 3D preview of the finished part.'],
 ['03 Plan the job','The CAM step: add operations in order (face, spot drill, drill, pocket, profile), pick tools, depth per pass and feed. Live tool-load bars, a plan check, and the cycle-time estimate. Click an operation to see its toolpath in 3D.'],
 ['04 Machine it','Cycle start: the 3D mill cuts the part from the stock with chips flying, the G-code highlighted line by line, tool changes, tool load and cycle time.'],
 ['05 Inspect','Every size measured against the drawing\'s tolerance, pass or fail, stars, and plain-language reasons for every failure.'],
 ['06 Challenges','Best result for every part in every material, against a target time.'],
 ['07 Design a part','Extension: choose an outline and thickness, add holes and pockets; the drawing draws itself; then plan and machine it.'],
 ['08 Exit ticket','Four questions answered on paper (answers in the Teacher edition).'],
]);
const agenda=table([1300,2000,6940],[
 ['Minutes','Segment','Activity'],
 ['0–8','Hook','Project §04: Keychain tag, example plan, Cycle start. Who told the machine where to go?'],
 ['8–20','Meet the machine','§01: CAD → CAM → G-code → CNC; jog to the three targets; tools; quick check.'],
 ['20–30','Read the drawing','§02: the Keychain tag drawing together; the two drawing questions.'],
 ['30–50','Plan the job','§03: build the plan one operation at a time from an empty plan.'],
 ['50–65','Machine and inspect','§04–§05: run, measure, fix the plan, run again until it passes.'],
 ['65–84','Challenges','§06: other parts and aluminum; beat the target time without breaking a tool.'],
 ['84–90','Exit ticket','§08 on paper.'],
 ['Extra','Design a part','§07: fast finishers, a second lesson or homework.'],
]);
const ops=table([2050,8190],[
 ['Operation','What it does and what to watch'],
 ['Face the top','Skims 0.05 in off the top with the 2 in face mill. Z 0 is the faced top, so without it the part ends up 0.05 in too thick and pockets 0.05 in too deep.'],
 ['Spot drill','A short, stiff 90° point marks every hole centre. Without it the drills wander and hole positions miss their ±0.005 in tolerance.'],
 ['Drill holes','One operation per hole size. A drill makes a hole its own size, so students must read the callout and pick that drill. Holes deeper than 2 drill diameters need "Peck drill", or chips pack in and the drill breaks.'],
 ['Pocket','Clears a pocket round and round, a little deeper each pass. The tool must fit, and an end mill leaves its own radius in the corners: small corner radii need a small end mill.'],
 ['Profile (cut out)','Cuts around the outline to free the part. Do it last, and leave tabs: without tabs the part breaks free and is scrapped; anything cut after the profile shakes and comes out the wrong size.'],
]);
const mistakes=table([3500,6740],[
 ['If the plan…','…students see'],
 ['skips facing','Thickness and pocket depths 0.05 in out of tolerance.'],
 ['skips the spot drill','Hole positions out of tolerance.'],
 ['uses the wrong drill','A hole diameter out of tolerance.'],
 ['uses too big an end mill in a pocket','Too-round corners (out of tolerance) or "too big to fit" in the plan check.'],
 ['cuts the outline before other features','Those features shaken out of tolerance.'],
 ['has no tabs','The part breaks free: scrap, no stars.'],
 ['has no peck on a deep hole','The drill breaks and the run stops.'],
 ['pushes the feed or depth too far','The tool breaks (load bar in the red).'],
 ['uses wax feeds on aluminum','A tool breaks: aluminum needs much slower feeds.'],
]);

const doc=new Document({numbering:{config:[{reference:'b',levels:[{level:0,format:LevelFormat.BULLET,text:'•',alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:320,hanging:220}}}}]}]},
 sections:[{properties:{page:{size:{width:12240,height:15840},margin:{top:720,bottom:720,left:1000,right:1000}}},
  footers:{default:new Footer({children:[new Paragraph({alignment:AlignmentType.RIGHT,children:[r('CNC Machining Center v1.0 · Quick guide · page ',{size:16,color:'777777'}),new TextRun({children:[PageNumber.CURRENT],font:F,size:16,color:'777777'}),r(' of 3',{size:16,color:'777777'})]})]})},
  children:[
  new Paragraph({children:[r('CNC Machining Center',{bold:true,size:34})],spacing:{after:0}}),
  new Paragraph({children:[r('Interactive machining lesson v1.0 · Quick guide for teachers · 9th grade · about 90 minutes',{color:'555555'})],border:{bottom:{style:BorderStyle.SINGLE,size:6,color:ACC,space:3}},spacing:{after:100}}),
  H('The two files',true),
  bl([B('CNC Machining Center - Teacher.html: '),r('every activity plus the teacher plan, agenda and answer keys. Use it to plan and to project in class.')]),
  bl([B('CNC Machining Center - Student.html: '),r('the same activities with the plan and answer keys removed from the file itself. Give this one to students.')]),
  bl([r('Each is a single standalone HTML file (about 0.7 MB). '),B('No install, no internet, no account: '),r('double-click to open in Chrome, Edge, Firefox or Safari, including on Chromebooks. A laptop or Chromebook works best.')]),
  H('Getting started'),
  bl([B('Share: '),r('email the Student file, post it to your LMS, or copy it to a shared drive or USB stick. Students download it and double-click.')]),
  bl([B('Move around: '),r('one section at a time, with the section bar at the top or the Next button at the end of each section. '),B('Show all'),r(' switches to one long page.')]),
  bl([B('The machine panel: '),r('the 3D mill appears in sections 01–04. Cameras: Machine, Close-up, Top, Front; drag to turn the view, scroll or pinch to zoom. The panel shows the tool position (X, Y, Z), tool, spindle speed, feed and tool load; tabs show the operations, the G-code and a log.')]),
  bl([B('Coordinates: '),r('inches from the work zero: X 0, Y 0 is the front-left corner of the stock; Z 0 is the top of the finished part, so cuts have negative Z.')]),
  bl([B('Saved on each computer: '),r('the last section, the part and material, each part\'s plan, the student\'s own design and the best results, in that browser only. Nothing is sent anywhere.')]),
  bl([B('Before class: '),r('open the Student file once on a classroom computer and check the 3D machine appears in §01.')]),
  H('What is in the lesson'),
  sections,
  H('Suggested 90-minute plan'),
  agenda,

  H('Plan the job (§03): the operations'),
  P([r('Add operations with the buttons on the left, in the order the machine should do them, or press '),B('Load the example plan'),r('. Each card has a tool, a depth per pass and a feed. The spindle speed is set automatically. The '),B('tool-load bar'),r(' shows how hard the cut pushes the tool: past the dashed line is risky, and over 108% the tool breaks. The plan check lists missing features and anything that stops the program from running.')]),
  ...IMG('shot-plan-c.png',560,161,'§03: operation cards with tool, depth per pass, feed, spindle speed, time and tool load.'),
  ops,
  H('Machine it (§04)'),
  P([B('Cycle start'),r(' runs the program. '),B('Feed hold'),r(' pauses, '),B('Reset'),r(' puts new stock in the vise, '),B('Finish this operation now'),r(' jumps to the end of the current operation, and the speed menu runs the job up to 60× faster than real time. The '),B('G-code'),r(' tab highlights the line being run (G0 fast moves, G1 straight cuts, G2/G3 arcs, G81/G83 drilling cycles, T… M6 tool changes).')]),
  ...IMG('shot-run.png',560,272,'§04: the Motor mount plate in aluminum, part way through cutting out the outline, with the G-code it is running.'),
  H('Inspect (§05): the lessons built into the plan'),
  P([r('Every size is measured against its tolerance, and §05 explains each failure in plain words. Mistakes in the plan show up as real defects:')]),
  mistakes,
  ...IMG('shot-insp.png',540,111,'§05 after a plan with no spot drill and too big an end mill in the pocket.'),
  H('Challenges and scoring (§06)'),
  bl([B('Stars: '),r('one for a finished part, two when every size passes, three when every size passes and the cycle time beats the target. The example plan is safe but slow, so it earns two stars; for three, students raise feeds and depths while keeping the tool-load bars out of the red.')]),
  bl([B('Materials: '),r('wax is soft and forgiving, HDPE plastic is in between, and aluminum needs much slower feeds. Changing the material keeps the plan\'s feeds, a good lesson in itself.')]),
  H('Design a part (§07)'),
  bl([r('Choose a rounded rectangle, slot or circle and a thickness; add up to 6 holes (standard drill sizes) and 3 pockets. The drawing updates as students type, and a check flags features that are too close to an edge, overlapping, or too small for the smallest end mill. '),B('Use my part'),r(' adds it to the part list to plan and machine.')]),
  H('Teaching tips'),
  bl([r('Hook with the example plan, then have pairs build their own plan from an empty one. Let them make mistakes: §05 explains each one.')]),
  bl([r('Link to the Tolerances lesson: §05 is a real inspection report. Ask why holes have a tighter tolerance than the outline.')]),
  bl([r('Feeds and speeds here are simplified teaching values for this simulation, not settings for a real machine.')]),
  H('Answer key (also in the Teacher edition)'),
  bl([B('Exit ticket: '),r('(1) CAD (draw) → CAM (plan the cuts) → G-code (instructions) → CNC machine (cuts). (2) Once the outline is cut through, the part is no longer held by the stock; tabs keep it attached until the end. (3) The Ø0.250 drill, because a drill makes a hole its own size; a spot drill marks the centre so the drill does not wander. (4) The cycle time goes down, but the force on the tool goes up; too much and it breaks.')]),
  H('If something goes wrong'),
  bl([B('The 3D view is blank: '),r('turn on hardware acceleration in the browser settings, or use another browser.')]),
  bl([B('Machine it is greyed out: '),r('the plan check in §03 has a problem marked with a red cross, often a drill operation with no drill chosen yet.')]),
 ]}]});
Packer.toBuffer(doc).then(b=>fs.writeFileSync(path.join(__dirname,'..','..','CNC Machining Center - Quick Guide.docx'),b));
