export const LINE_LABELS={hair:'Догляд за волоссям',body:'Догляд за тілом',other:'Інше'};
export function productAudience(raw={},groups=[]){
 const explicit=String(raw['Лінійка']||raw.audience||'').trim().toLowerCase();
 for(const [id,label] of Object.entries(LINE_LABELS))if(explicit===id||explicit===label.toLowerCase())return id;
 const content=[...groups,raw.group,raw.category,raw['Група'],raw['Категорія']].filter(Boolean).join(' ').toLowerCase();
 if(/волосс|шампун|кондиціонер|маск.*волос|стайлінг|фарб.*волос|hair|scalp/.test(content))return 'hair';
 if(/тіл|шкір|облич|рук|ніг|душ|body|skin|face|крем|лосьйон|скраб/.test(content))return 'body';
 return 'other';
}
