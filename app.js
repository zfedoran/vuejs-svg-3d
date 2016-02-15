;(function() {

    function Scene() {
        this.root = new Object3d();
        this.list = [];

        var self = this;
        this.root._onAddedHandler = function (child) {
            self.list.push(child);
        };

        this.add = function (obj3d) {
            this.root.add(obj3d);
        }
    }

    function Object3d() {
        this.parent   = null;
        this.children = [];
        this.position = vec3.create();
        this.rotation = vec3.create();
        this.scale    = vec3.create();

        this._quat    = quat.create();
        this._world   = mat4.create();
        this._local   = mat4.create();

        this.add = function (child) {
            child.parent = this;
            this.children.push(child);

            child._onAddedHandler = this._onAddedHandler;
            this._onAddedHandler(child);
        }

        this.updateLocalMatrix = function () {
            quat.identity(this._quat);
            quat.rotateX(this._quat, this._quat, this.rotation[0]);
            quat.rotateY(this._quat, this._quat, this.rotation[1]);
            quat.rotateZ(this._quat, this._quat, this.rotation[2]);

            mat4.fromRotationTranslation(this._local, this._quat, this.position);
        }

        this.updateWorldMatrix = function () {
            this.updateLocalMatrix();

            if (this.parent === null) {
                mat4.copy(this._world, this._local);
            } else {
                mat4.mul(this._world, this.parent._world, this._local);
            }
            for (var i = 0; i < this.children.length; i++) {
                this.children[i].updateWorldMatrix();
            }
        }
    }

    function QuadMesh() {
        var a = vec3.fromValues(-0.5, -0.5, 0);
        var b = vec3.fromValues( 0.5, -0.5, 0);
        var c = vec3.fromValues( 0.5,  0.5, 0);
        var d = vec3.fromValues(-0.5,  0.5, 0);

        this.color = (Math.floor(Math.random() * 0xffffff)).toString(16);
        this.vertices = [a, b, c, d];
    }

    function Camera (fov, aspect, near, far) {
        this.up          = vec3.fromValues(0, 1, 0);
        this.position    = vec3.create();
        this.target      = vec3.create();

        this.near        = near;
        this.far         = far;
        this.aspect      = aspect;
        this.fov         = fov * Math.PI / 180;

        this.view        = mat4.create();
        this.perspective = mat4.create();

        this.update = function () {
            mat4.lookAt(this.view, this.position, this.target, this.up);
            mat4.perspective(this.perspective, this.fov, this.aspect, this.near, this.far);
        }
    }

    function Device(width, height) {
        this.width  = width;
        this.height = height;

        var m = mat4.create();
        var v = vec3.create();

        this.render = function (obj3d, camera) {
            // Create ModelViewProjection matrix
            mat4.mul(m, camera.view, obj3d._world);
            mat4.mul(m, camera.perspective, m);

            var poly = '';
            for (var i = 0; i < obj3d.mesh.vertices.length; i++) {
                vec3.transformMat4(v, obj3d.mesh.vertices[i], m);

                // Project to 2D points
                var x =  v[0] * this.width  + this.width  / 2.0 >> 0;
                var y = -v[1] * this.height + this.height / 2.0 >> 0;

                // Append to SVG poly string
                poly += x + ',' + y + ' ';
            }

            return poly;
        }
    }

    new Vue({
        el: '#app',
        data: function () {
            var width  = $(window).width();
            var height = $(window).height();

            var scene  = new Scene();
            var cube   = new Object3d();
            scene.add(cube);

            var front         = new Object3d();
            front.mesh        = new QuadMesh();
            front.mesh.color  = '050D9E';
            front.position[2] = -0.5;
            cube.add(front);

            var back          = new Object3d();
            back.mesh         = new QuadMesh();
            back.mesh.color   = '00C4B3';
            back.position[2]  = 0.5;
            cube.add(back);

            var left          = new Object3d();
            left.mesh         = new QuadMesh();
            left.mesh.color   = 'FF661B';
            left.position[0]  = -0.5;
            left.rotation[1]  = Math.PI / 2;
            cube.add(left);

            var right         = new Object3d();
            right.mesh        = new QuadMesh();
            right.mesh.color  = '000000';
            right.position[0] = 0.5;
            right.rotation[1] = Math.PI / 2;
            cube.add(right);

            var camera = new Camera(80, width / height, 1, 1000);
            var device = new Device(width, height);

            return {
                time     : 0,
                camera   : camera,
                device   : device,
                scene    : scene,
                polygons : []
            }
        },
        created: function () {
            var self = this;

            $(window).on('resize', function () {
                self.device.width  = $(window).width();
                self.device.height = $(window).height();
                self.camera.aspect = self.device.width / self.device.height;
            });
        },
        ready: function () {
            var self = this;

            vec3.set(self.camera.position, 7, 6, 5);

            function render_loop() {
                requestAnimationFrame(render_loop);

                // Rotate the scene root
                vec3.set(self.scene.root.rotation,
                    self.time * 1.5,
                    self.time * 1.4,
                    self.time * 1.3);

                self.scene.root.updateWorldMatrix();
                self.camera.update();

                // Render out all quads
                self.polygons = [];
                for (var i = 0; i < self.scene.list.length; i++) {
                    var obj3d = self.scene.list[i];

                    if (obj3d.mesh) {
                        var poly = {
                            color  : obj3d.mesh.color,
                            points : self.device.render(obj3d, self.camera),
                            depth  : vec3.dist(self.camera.position,
                                             vec3.fromValues(obj3d._world[13], 
                                                             obj3d._world[14], 
                                                             obj3d._world[15]))
                        };

                        self.polygons.push(poly);
                    }

                }

                self.polygons.sort(function (a, b) {
                    return b.depth - a.depth;
                });

                self.time += 1 / 60;
            }

            render_loop();
        }
    });

})();
