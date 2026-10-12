declare module '@/drizzle/migrations' {
  const migrations: {
    journal: any;
    migrations: Record<string, string>;
  };
  export default migrations;
}

declare module '*.sql' {
  const content: string;
  export default content;
}
