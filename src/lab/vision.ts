import { FaceLandmarker, FilesetResolver, GestureRecognizer } from '@mediapipe/tasks-vision';

// Versão travada igual à do package.json: o wasm precisa ser o mesmo do código JS.
const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm';
const FACE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const GESTURE_MODEL =
    'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';

export interface Vision {
    face: FaceLandmarker;
    hands: GestureRecognizer;
    close: () => void;
}

/** Carrega os dois modelos (rosto com expressões e mãos com gestos). Tenta a GPU e cai para a CPU. */
export const loadVision = async (): Promise<Vision> => {
    const fileset = await FilesetResolver.forVisionTasks(WASM);

    const make = async (delegate: 'GPU' | 'CPU') =>
        Promise.all([
            FaceLandmarker.createFromOptions(fileset, {
                baseOptions: { modelAssetPath: FACE_MODEL, delegate },
                runningMode: 'VIDEO',
                numFaces: 1,
                outputFaceBlendshapes: true,
            }),
            GestureRecognizer.createFromOptions(fileset, {
                baseOptions: { modelAssetPath: GESTURE_MODEL, delegate },
                runningMode: 'VIDEO',
                numHands: 2,
            }),
        ]);

    let face: FaceLandmarker;
    let hands: GestureRecognizer;
    try {
        [face, hands] = await make('GPU');
    } catch {
        [face, hands] = await make('CPU');
    }

    return {
        face,
        hands,
        close: () => {
            face.close();
            hands.close();
        },
    };
};
