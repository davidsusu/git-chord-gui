export default interface GitChordInterface {
    version(): Promise<string>,
    help(): Promise<string>,
    state(): Promise<string>,
    config(): Promise<string>,
    configOverrides(): Promise<string>,
    configSet(key: string, value: string): Promise<string>,
    configReset(key: string): Promise<string>,
    list(): Promise<string>,
}
