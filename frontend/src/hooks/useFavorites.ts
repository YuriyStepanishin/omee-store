'use client';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {useAuthStore} from '@/store/auth';
import {http} from '@/services/http';
export function useFavorites() {
  const user=useAuthStore(state=>state.user);
  const client=useQueryClient();
  const query=useQuery({queryKey:['favorites',user?.id,'ids'],enabled:Boolean(user),queryFn:async()=>(await http.get<{ids:string[]}>('/account/favorites/ids')).data.ids});
  const mutation=useMutation({mutationFn:async({productId,saved}:{productId:string;saved:boolean})=>{
    if(saved)await http.delete(`/account/favorites/${productId}`);
    else await http.put(`/account/favorites/${productId}`);
  },onSuccess:async()=>{await client.invalidateQueries({queryKey:['favorites',user?.id]});}});
  return {user,ids:query.data||[],query,mutation};
}
