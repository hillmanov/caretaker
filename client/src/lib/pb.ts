import PocketBase from 'pocketbase';
import { TypedPocketBase } from "../types"

const pb = new PocketBase('/') as TypedPocketBase;

export default pb;
