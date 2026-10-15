const fs = require('fs');
const path = require('path');   // run: NODE_PATH=$(npm root -g) node make.js   (needs the docx package)
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, LevelFormat, AlignmentType, PageBreak, Footer, PageNumber, ImageRun } = require('docx');
const F='Calibri', SZ=20;   // 10 pt body
const r=(t,o={})=>new TextRun({text:t,font:F,size:SZ,...o});
const B=t=>r(t,{bold:true});
const H=(t,first,brk)=>new Paragraph({pageBreakBefore:!!brk,children:[r(t,{bold:true,size:22,color:'B4400B'})],spacing:{before:first?40:110,after:40},keepNext:true});
const P=(kids,o={})=>new Paragraph({children:kids,spacing:{after:50,line:244},...o});
const bl=kids=>new Paragraph({children:kids,numbering:{reference:'b',level:0},spacing:{after:20,line:244}});
const TW=10240;
const IMG=(f,w,h,cap)=>[new Paragraph({alignment:AlignmentType.CENTER,keepNext:true,spacing:{before:60,after:20},children:[new ImageRun({type:'png',data:fs.readFileSync(path.join(__dirname,f)),transformation:{width:w,height:h}})]}),new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:80},children:[r(cap,{italics:true,size:18,color:'666666'})]})];
const bd={style:BorderStyle.SINGLE,size:4,color:'BFC9D3'}, borders={top:bd,bottom:bd,left:bd,right:bd};
const cell=(kids,w,shade)=>new TableCell({children:[new Paragraph({children:kids,spacing:{after:0,line:228}})],width:{size:w,type:WidthType.DXA},borders,margins:{top:25,bottom:25,left:80,right:80},...(shade?{shading:{type:ShadingType.CLEAR,fill:shade,color:'auto'}}:{})});
const table=(W,rows)=>new Table({width:{size:TW,type:WidthType.DXA},columnWidths:W,rows:rows.map((rw,i)=>new TableRow({cantSplit:true,tableHeader:i===0,children:rw.map((c,j)=>cell([r(c,{bold:i===0||j===0})],W[j],i?null:'FBE3D6'))}))});

const sections=table([2000,8240],[
 ['Section','What students do'],
 ['00 Plan','Teacher edition only: objectives, 90-minute agenda, key terms.'],
 ['01 Meet the drone','A 3D drone with four motor sliders and thrust arrows. Presets (hover, climb, forward, turn) and a "what happens" readout; 3-question check.'],
 ['02 Plan a path','Click a map of the cage to place waypoints, drag heights in the side view, tag pick / drop / land. A pre-flight check flags every leg that would hit something.'],
 ['03 Program it','Snap blocks together into a program: flying, the claw, loops, sensor readings and if / else. The running block lights up. "Show as code" shows the same program as Python-style code.'],
 ['04 Autopilot','Step through how the autopilot plans (no-fly zones, the search, the straightened route), then watch it fly. Move the cube and fly again.'],
 ['05 Fly it yourself','Manual flight with the keyboard or an on-screen pad, a follow camera and a drone-cam inset.'],
 ['06 Challenges','Five scored levels, flown in any mode, with stars and a best score per level.'],
 ['07 Design a course','Extension: build your own course, check that it can be flown, share it as a code.'],
 ['08 Exit ticket','Four questions answered on paper (answers in the Teacher edition).'],
]);
const agenda=table([1300,2000,6940],[
 ['Minutes','Segment','Activity'],
 ['0–6','Hook','Project §04 and press Launch: the autopilot flies the whole course.'],
 ['6–16','Meet the drone','§01 presets, then climb, move and turn on their own; quick check.'],
 ['16–30','Plan a path','§02: coordinates, then a Gate 1 path with a clean pre-flight check.'],
 ['30–50','Program it','§03: run the three examples, then the "Try it" tasks.'],
 ['50–60','Autopilot','§04: step through the route search; Move cube and fly again.'],
 ['60–70','Fly it yourself','§05: each partner flies Gate 1 and back.'],
 ['70–84','Challenges','§06: levels 1–3 in any mode; fast pairs try levels 4 and 5.'],
 ['84–90','Exit ticket','§08 on paper.'],
 ['Extra','Design a course','§07: fast finishers, a second lesson or homework.'],
]);
const blocks=table([3300,6940],[
 ['Block','What it does'],
 ['take off to height _ ft','Starts the motors and climbs straight up; needed before any flying block.'],
 ['fly to x _ y _ height _','Flies in a straight line to that point (same coordinates as the §02 map).'],
 ['move north / south / east / west / up / down _ ft','Moves that far from where the drone is now.'],
 ['fly over the cube / the bin / pad H at height _','Flies straight to above that object, wherever it is now.'],
 ['fly through gate _','Lines up in front of the gate and flies through it.'],
 ['close the claw / open the claw','Grabs the cube (the claw must be just above it) or drops it.'],
 ['land','Comes straight down and stops the motors. Land on pad H to score.'],
 ['repeat _ times','Runs the blocks inside it that many times.'],
 ['repeat until (condition)','Runs the blocks inside it again and again until the condition is true.'],
 ['if (condition) … else …','Runs one set of blocks or the other.'],
 ['wait _ seconds / say "…"','Hovers in place / writes a message in the Log tab.'],
 ['Conditions','A distance sensor (front, right, rear, left, down) less than or greater than _ ft; the camera sees the cube; the claw is holding the cube.'],
]);

const doc=new Document({numbering:{config:[{reference:'b',levels:[{level:0,format:LevelFormat.BULLET,text:'•',alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:320,hanging:220}}}}]}]},
 sections:[{properties:{page:{size:{width:12240,height:15840},margin:{top:720,bottom:720,left:1000,right:1000}}},
  footers:{default:new Footer({children:[new Paragraph({alignment:AlignmentType.RIGHT,children:[r('PVC Quad Course v1.1 · Quick guide · page ',{size:16,color:'777777'}),new TextRun({children:[PageNumber.CURRENT],font:F,size:16,color:'777777'}),r(' of 3',{size:16,color:'777777'})]})]})},
  children:[
  new Paragraph({children:[r('PVC Quad Course',{bold:true,size:34})],spacing:{after:0}}),
  new Paragraph({children:[r('Interactive drone lesson v1.1 · Quick guide for teachers · 9th grade · about 90 minutes',{color:'555555'})],border:{bottom:{style:BorderStyle.SINGLE,size:6,color:'D9480F',space:3}},spacing:{after:100}}),
  H('The two files',true),
  bl([B('PVC Quad Course - Teacher.html: '),r('every activity plus the teacher plan, agenda and answer keys. Use it to plan and to project in class.')]),
  bl([B('PVC Quad Course - Student.html: '),r('the same activities with the plan and answer keys removed from the file itself. Give this one to students.')]),
  bl([r('Each is a single standalone HTML file (about 0.8 MB). '),B('No install, no internet, no account: '),r('double-click to open in Chrome, Edge, Firefox or Safari, including on Chromebooks. A laptop or Chromebook works best; a phone works but is cramped.')]),
  H('Getting started'),
  bl([B('Share: '),r('email the Student file, post it to your LMS, or copy it to a shared drive or USB stick. Students download it and double-click.')]),
  bl([B('Move around: '),r('one section at a time. Use the section bar at the top (the arrows, or click a numbered section) or the Next button at the end of each section. '),B('Show all'),r(' switches to one long page.')]),
  bl([B('The flight deck: '),r('the 3D cage appears in sections 02–07. Pick a mode ('),B('My path, Program, Autopilot, Manual'),r(') and press '),B('Launch'),r('. Cameras: Follow, Whole cage, Drone cam, Top. Drag to turn the view, scroll or pinch to zoom. The Instruments tab shows the sensors and motors; the Log tab says what happened.')]),
  bl([B('Coordinates: '),r('(x, y, height) in feet: x east, y north, height above the floor; the cage centre is (0, 0). The cage is 10 ft wide and 20 ft tall.')]),
  bl([B('Saved on each computer: '),r('the last section, the flight path, the program, the course, the chosen level and the best scores, in that browser only. Nothing is sent anywhere. Shared or locked-down computers may forget them between sessions.')]),
  bl([B('Before class: '),r('open the Student file once on a classroom computer, press Launch in §04 and check the drone flies. That confirms the browser can show 3D.')]),
  H('What is in the lesson'),
  sections,
  H('Suggested 90-minute plan'),
  agenda,

  H('Program it (§03): the blocks'),
  P([r('Click a block in the coloured list to add it at the orange marker; click a gap in the program to move the marker. Blocks can also be dragged in with a mouse. Each block has up and down arrows to move it, ✕ to delete it, and a handle to drag it. Press '),B('Run program'),r(': the drone does one block at a time and the running block lights up yellow.')]),
  ...IMG('shot-prog-crop.png',520,274,'§03 with the "Pick and drop with a sensor" example loaded: blocks on the left, the program on the right.'),
  blocks,
  bl([B('Examples: '),r('"Gate 1 and back", "Pick and drop with a sensor" (uses repeat until and if / else) and "Full course". Each one also sets the matching challenge level.')]),
  bl([B('Key idea: '),r('"repeat until down sensor < 0.4 ft: move down 0.25 ft" lowers the drone in small steps until it is just above whatever is below it. It works from any height, unlike one fixed "move down" block. Blocks fly straight lines; only the autopilot (§04) plans around obstacles by itself.')]),
  bl([B('When a program stops: '),r('the block at fault turns red, the drone lands, and the Log tab gives the reason (for example, flying before take-off, a gate that does not exist, or a loop that never ends; programs stop after 400 blocks).')]),
  H('Design a course (§07)'),
  bl([B('Start from '),r('Original, Empty cage, Slalom or Up high, or add gates, hoops and poles with the + buttons.')]),
  bl([B('Drag '),r('anything on the map to move it; click it to set heights, width, the direction the autopilot flies through a gate, gate order, and cross bars between poles.')]),
  bl([B('Check course '),r('flags openings too small for the drone and has the autopilot plan the whole course. Then press Launch to watch it fly.')]),
  bl([B('Course code: '),r('Copy code to share a course; paste another pair\'s code and press Load this code to fly theirs.')]),
  bl([B('Important: '),r('the designed course is used everywhere in the lesson (paths, programs, challenges) and keeps its own best scores. Press '),B('Original'),r(' to go back to the lesson\'s course.')]),
  ...IMG('shot-design.png',500,241,'§07 with the Slalom course: drag things on the map, change the selected gate on the right, then Check course.'),
  H('Challenges and scoring (§06)'),
  bl([B('Levels: '),r('1 First flight (Gate 1 and back), 2 Pick and drop, 3 Full course, 4 Windy day, 5 Surprise cube (the cube moves on every launch).')]),
  bl([B('Points: '),r('100 per goal, minus 25 per contact, plus a time bonus when every goal is met. '),B('Stars: '),r('one for some goals, two for every goal, three for every goal with no contacts under the target time.')]),
  bl([B('Wind and Move cube: '),r('the Wind box and the Move cube button on the flight deck work in any mode, so students can test whether a path, a program or the autopilot copes.')]),
  bl([B('Manual keys (§05): '),r('R / F climb and descend, W / S forward and back, A / D left and right, Q / E turn, G grab or drop. Click the 3D view first, or use the on-screen pad. The Top camera makes lining up over the cube much easier.')]),
  H('Teaching tips'),
  bl([r('In §02 start with "Load a Gate 1 example"; insist on a clean pre-flight check before every launch.')]),
  bl([r('In §03 run each example first, then edit it: wrap blocks in a repeat, change a height, press Move cube and run the sensor program again.')]),
  bl([r('Debrief §04: after Move cube, why does the autopilot still find the cube when a saved path misses it, and why can the sensor program find it too?')]),
  H('Answer key (also in the Teacher edition)'),
  bl([B('§03 Try it: '),r('(1) put "fly through gate 1" and "move west 2.8 ft" inside "repeat 3 times". (2) "fly over the cube" goes to where the cube is now, and the sensor loop stops just above it. (3) the "while" line is the loop; the lines inside it are indented.')]),
  bl([B('Exit ticket: '),r('(1) front props faster, back props slower: the nose tips up and the drone moves backward. (2) (−2, 3, 6). (3) a saved path goes to where the cube used to be; the autopilot finds it and re-plans. (4) it steps down until something is less than 0.4 ft below it, so it works from any height; a fixed move could stop too high or hit the cube.')]),
  H('If something goes wrong'),
  bl([B('The 3D view is blank or says it could not start: '),r('turn on hardware acceleration in the browser settings, or use another browser.')]),
  bl([B('Manual flight ignores the keys: '),r('click the 3D view first so it receives the key presses, or use the on-screen pad.')]),
  bl([B('A program stops early: '),r('look for the red block and read the Log tab; the usual cause is a missing take-off block or a gate number the course does not have.')]),
  bl([B('The course looks different from the lesson: '),r('someone designed a course in §07. Open §07 and press Original.')]),
 ]}]});
Packer.toBuffer(doc).then(b=>fs.writeFileSync(path.join(__dirname,'..','..','PVC Quad Course - Quick Guide.docx'),b));
