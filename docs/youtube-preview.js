export function youtubeVideoId(value) {
  try {const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.port)return null;
    let id=null;
    if(url.hostname==='youtu.be')id=url.pathname.slice(1);
    else if(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com'].includes(url.hostname)){
      if(url.pathname==='/watch')id=url.searchParams.get('v');
      else id=url.pathname.match(/^\/(?:live|shorts|embed)\/([^/]+)\/?$/)?.[1];
    }
    return /^[\w-]{11}$/.test(id||'')?id:null;
  } catch{return null;}
}
export function youtubePreviewHtml(event) {
  const id=(event.links||[]).map(link=>youtubeVideoId(link.url)).find(Boolean);
  if(!id)return '';
  return `<a class="youtube-preview" href="https://www.youtube.com/watch?v=${id}" target="_blank" rel="noopener noreferrer" aria-label="觀看 YouTube 直播"><img data-youtube-id="${id}" src="https://i.ytimg.com/vi/${id}/maxresdefault.jpg" alt="" referrerpolicy="no-referrer"><span aria-hidden="true">▶</span></a>`;
}
export function bindYouTubePreviews(root) {
  root.querySelectorAll('img[data-youtube-id]').forEach(img=>{
    if(img.dataset.bound)return;img.dataset.bound='true';let fallback=false;
    const fail=()=>{if(!fallback){fallback=true;img.src=`https://i.ytimg.com/vi/${img.dataset.youtubeId}/mqdefault.jpg`;}else img.closest('.youtube-preview').hidden=true;};
    img.addEventListener('error',fail);
    img.addEventListener('load',()=>{if(img.naturalWidth<=120)fail();});
    if(img.complete){if(!img.naturalWidth||img.naturalWidth<=120)fail();}
  });
}
