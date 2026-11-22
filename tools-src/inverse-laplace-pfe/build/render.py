import json,subprocess,sys,os,re
pg=sys.argv[1]; lines=json.load(open(f'script_{pg}.json')); out=[]
for i,t in enumerate(lines,1):
    f=f'clips_{pg}/{pg}_line{i}.mp3'
    for attempt in range(4):
        r=subprocess.run(['edge-tts','--proxy',os.environ['HTTPS_PROXY'],'--voice','en-GB-SoniaNeural','--rate=-4%','--text',t,'--write-media',f],capture_output=True,text=True)
        if r.returncode==0 and os.path.getsize(f)>2000: break
    else: print('FAIL',i,r.stderr[-300:]); sys.exit(1)
    d=float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f],capture_output=True,text=True).stdout)
    w=len([x for x in re.split(r'[\s\-—–]+',t) if re.search(r'\w',x)]); out.append((i,round(d,3),os.path.getsize(f),w,round(w/d*60)))
    print(out[-1],flush=True)
json.dump(out,open(f'clips_{pg}/durations.json','w'))
print('total',round(sum(o[1] for o in out),2),'bytes',sum(o[2] for o in out))
