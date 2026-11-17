export interface ArticleSummary {
 id:string;slug:string;title:string;excerpt:string;category:string;author:string;date:string;
}
export interface Article extends ArticleSummary {
 media:Array<{type:'photo'|'video';url:string;caption:string}>;body:string;seoTitle:string;seoDescription:string;sources:Array<{title:string;url:string;accessedAt:string}>;
}
