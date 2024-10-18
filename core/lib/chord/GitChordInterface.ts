export default interface GitChordInterface {
    version(): Promise<string>,
    help(): Promise<string>,
}
