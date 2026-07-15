export enum TenantResourceType {
  CLIENT = 'client',   // o :param JÁ É o clientId
  PROJECT = 'project', // o :param é um projectId -> resolve project.clientId
  POST = 'post',       // o :param é um postId -> resolve post.project.clientId
}
