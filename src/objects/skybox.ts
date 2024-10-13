import * as THREE from 'three'
import {Vector3} from "three";
import {BehaviorSubject} from "rxjs";

export class Skybox {
    private skyboxGeometry: THREE.SphereGeometry
    private skyboxMaterial: THREE.MeshBasicMaterial
    private skyboxMesh: THREE.Mesh

    private galaxyGeometry: THREE.PlaneGeometry
    private galaxyMaterial: THREE.MeshBasicMaterial
    private galaxyMesh: THREE.Mesh

    galaxyVisible: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false)

    constructor(
        x: number=0,
        y: number=0,
        z: number=0,
        radius: number=100,
    ) {
        this.skyboxGeometry = new THREE.SphereGeometry(radius, 32, 32)
        this.skyboxMaterial = new THREE.MeshBasicMaterial({
            map: new THREE.TextureLoader().load("skybox.png"),
            side: THREE.BackSide,
            transparent: false,
        })
        this.skyboxMesh = new THREE.Mesh(this.skyboxGeometry, this.skyboxMaterial)
        this.skyboxMesh.position.set(x, y, z)


        this.galaxyGeometry = new THREE.PlaneGeometry(radius*8, radius*8)
        this.galaxyMaterial = new THREE.MeshBasicMaterial({
            map: new THREE.TextureLoader().load("galaxy.png"),
            side: THREE.DoubleSide,
            transparent: false,
            opacity: 1,
        })
        this.galaxyMesh = new THREE.Mesh(this.galaxyGeometry, this.galaxyMaterial)
        this.galaxyMesh.position.set(x, y + 25500000, z)

        this.showGalaxy(false);
    }

    getMesh(): THREE.Mesh[] {
        return [this.skyboxMesh, this.galaxyMesh]
    }

    showGalaxy(bool: boolean) {
        if (bool === this.galaxyMesh.visible) {
            return;
        }

        this.galaxyVisible.next(bool)

        this.galaxyMesh.visible = bool
        this.skyboxMesh.visible = !bool

    }

    getPosition(): Vector3 {
        return this.skyboxMesh.position
    }

    setPosition(x: number, y: number, z: number) {
        this.skyboxMesh.position.set(x, y, z)
        this.galaxyMesh.position.set(x, y + 25500000, z)
    }
}
