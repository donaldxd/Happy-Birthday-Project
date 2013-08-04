/*jslint browser: true, devel: true */
(function () {
    "use strict";
    
    var myImage,
        myCanvas,
        myContainer,
        myCake,
        mouseIndicator,
        globalViscosity = 0.5,
        myCursorPosition = null,
        Pixel = function (red, green, blue) {
            this.red = red;
            this.green = green;
            this.blue = blue;
        },
        Point = function (x, y) {
            this.setPosition(x, y);
        },
        PointProto = {
            x : 0,
            y : 0,
            setPosition : function (x, y) {
                this.x = x;
                this.y = y;
            },
            getDistance : function (point) {
                return Math.sqrt(Math.pow(this.x - point.x, 2) + Math.pow(this.y - point.y, 2));
            }
        },
        Vector = function (x, y) {
            this.init(x, y);
        },
        VectorProto = {
            x : 0,
            y : 0,
            init : function (x, y) {
                this.x = x;
                this.y = y;
            },
            add : function (vector) {
                var v = new Vector(
                    this.x + vector.x,
                    this.y + vector.y
                );
                return v;
            },
            multiply : function (scale) {
                var v = new Vector(
                    this.x * scale,
                    this.y * scale
                );
                return v;
            },
            getSize : function () {
                return Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2));
            },
            unitary : function () {
                var v = new Vector(this.x, this.y);
                v = v.multiply(1 / this.getSize());
                return v;
            }
        },
        Spring = function (pointA, pointB, rigidity, min, max, isRepulsor) {
            this.init(pointA, pointB, rigidity, min, max, isRepulsor);
        },
        SpringProto = {
            pointA : null,
            pointB : null,
            rigidity : null,
            isRepulsor : null,
            min : null,
            max : null,
            maxLimit : null,
            init : function (pointA, pointB, rigidity, min, max, isRepulsor) {
                this.pointA = pointA;
                this.pointB = pointB;
                this.rigidity = rigidity;
                this.isRepulsor = isRepulsor;
                this.min = min;
                this.max = max;
                this.maxLimit = this.max + 10;
            },
            getEnergyVector : function () {
                //get the distance
                var distance = this.pointA.getDistance(this.pointB),
                    energy = 0,
                    energyVector = null;
                
                if (distance >= this.min && distance <= this.max) {
                    energy = Math.pow(distance, 2) * this.rigidity;
                    
                    energyVector = new Vector(this.pointA.x - this.pointB.x, this.pointA.y - this.pointB.y);
                    energyVector = energyVector.unitary();
                    energyVector = energyVector.multiply(energy);
                } else if (this.isRepulsor && distance > this.max && distance <= this.maxLimit) {
                    energy = Math.pow(10 - (this.max - distance), 2) * this.rigidity;
                    
                    energyVector = new Vector(this.pointA.x - this.pointB.x, this.pointA.y - this.pointB.y);
                    energyVector = energyVector.unitary();
                    energyVector = energyVector.multiply(energy);
                }
                
                return energyVector;
            }
        },
        PixelObject = function (pixel, coordinates, scale, container) {
            this.init(pixel, coordinates, scale);
            container.appendChild(this.domObject);
            
        },
        PixelObjectProto = {
            pixel : null,
            domObject : null,
            scale : 1,
            coordinates : null,
            position : null,
            forces : null,
            springs : null,
            init : function (pixel, coordinates, scale) {
                
                this.pixel = pixel;
                this.scale = scale;
                this.coordinates = new Point(coordinates.x * this.scale, coordinates.y * this.scale);
                this.position = new Point(this.coordinates.x, this.coordinates.y);
                this.forces = new Vector(0, 0);
                
                //initialise the dom object
                this.domObject = document.createElement('div');
                this.domObject.className = "pixel";
                this.domObject.style.backgroundColor = "rgb(" + this.pixel.red + "," + this.pixel.green + "," + this.pixel.blue + ")";
                this.domObject.style.width = this.scale + "px";
                this.domObject.style.height = this.scale + "px";
                
                this.translatePosition();
                
                this.springs = [];
                
                //add the spring attached to the pixel's position
                this.springs.push(
                    new Spring(this.coordinates, this.position, 0.005, 0.1, 9999, false)
                );
                //add the spring for the cursor
                
                this.springs.push(
                    new Spring(this.position, myCursorPosition, 0.002, 1, 50, true)
                );
                
                
            },
            translatePosition : function () {
                //update the dom object depending on the position
                var transform = 'translate3d(' + this.position.x + 'px, ' + this.position.y + 'px, 0)';
                this.domObject.style.MozTransform = transform;
                this.domObject.style.WebkitTransform = transform;
                this.domObject.style.OTransform = transform;
            },
            updatePosition : function () {
                var i,
                    energyVector,
                    finalEnergy = new Vector(0, 0);
                
                this.forces = this.forces.multiply(globalViscosity);
                
                for (i = this.springs.length - 1; i >= 0; i -= 1) {
                    energyVector = this.springs[i].getEnergyVector();
                    if (energyVector !== null) {
                        finalEnergy = finalEnergy.add(energyVector);
                    }
                }
                if (finalEnergy.getSize() > 0.001) {
                    this.forces = this.forces.add(finalEnergy);
                }
                
                if (this.forces.getSize() <= 0.001) {
                    this.forces = new Vector(0, 0);
                } else {
                    this.position.x = this.position.x + this.forces.x;
                    this.position.y = this.position.y + this.forces.y;
                    this.translatePosition();
                }
            }
        },
        Cake = function (myImg, myCanvas, myContainer) {
            this.init(myImg, myCanvas, myContainer);
        },
        CakeProto = {
            width : 0,
            height : 0,
            pixels : [],
            init : function (myImg, myCanvas, myContainer) {
                
                var i, j, scale, pixelData;
                
                //set the canvas width and height
                myCanvas.width = myImg.width;
                myCanvas.height = myImg.height;
                
                //set the object's width and height
                this.width = myImg.width;
                this.height = myImg.height;
                
                scale = parseInt(myContainer.clientWidth / this.width, 10);
                
                //set the image to the canvas
                myCanvas.getContext('2d').drawImage(myImg, 0, 0, myImg.width, myImg.height);
                
                //read the image from bottom to top
                for (i = this.height - 1; i >= 0; i -= 1) {
                    for (j = 0; j < this.width; j += 1) {
                      
                        //create a new pixel object and add it to the pixels array
                        pixelData = myCanvas.getContext('2d').getImageData(j, i, 1, 1).data;
                        if (pixelData[3] !== 0) {
                            
                            this.pixels.push(
                                new PixelObject(
                                    new Pixel(pixelData[0], pixelData[1], pixelData[2]),
                                    new Point(j, i),
                                    scale,
                                    myContainer
                                )
                            );
                        }
                    }
                }
            },
            updatePixelsPosition : function () {
                var i;
                for (i = this.pixels.length - 1; i >= 0; i -= 1) {
                    this.pixels[i].updatePosition();
                }
            }
        };
    
    
    //define the prototypes
    Point.prototype = PointProto;
    Vector.prototype = VectorProto;
    Spring.prototype = SpringProto;
    PixelObject.prototype = PixelObjectProto;
    Cake.prototype = CakeProto;
    
    myContainer = document.getElementById('main');
    myImage = document.getElementById('my-image');
    myCanvas = document.getElementById('my-canvas');
    mouseIndicator = document.getElementById('mouse-indicator');
    
    myCursorPosition = new Point(0, 0);
    
    //instanciate the cake
    myCake = new Cake(myImage, myCanvas, myContainer);
    
    //handle the mouse position
    function handleMouseMove(event) {
        myCursorPosition.setPosition(event.layerX, event.layerY);
    }
    myContainer.onmousemove = handleMouseMove;
    
    
    //launch the update function
    window.setInterval(function () {
        myCake.updatePixelsPosition();
    }, 16);
    
    
}());