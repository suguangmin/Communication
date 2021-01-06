
enum RemoteButton {
    //% block=A
    A = 0x45,
    //% block=B
    B = 0x46,
    //% block=C
    C = 0x47,
    //% block=D
    D = 0x44,
    //% block=UP
    UP = 0x40,
    //% block=+
    Add = 0x43,
    //% block=LEFT
    Left = 0x07,
    //% block=OK
    Ok = 0x15,
    //% block=RIGHT
    Right = 0x09,
    //% block=DOWN
    Down = 0x19,
    //% block=-
    EQ = 0x0d,
    //% block=0
    NUM0 = 0x16,
    //% block=1
    NUM1 = 0x0c,
    //% block=2
    NUM2 = 0x18,
    //% block=3
    NUM3 = 0x5e,
    //% block=4
    NUM4 = 0x8,
    //% block=5
    NUM5 = 0x1c,
    //% block=6
    NUM6 = 0x5a,
    //% block=7
    NUM7 = 0x42,
    //% block=8
    NUM8 = 0x52,
    //% block=9
    NUM9 = 0x4A,
}


enum IrPins {
    P0 = 3,
    P1 = 2,
    P2 = 1,
    P3 = 4,
    P4 = 5,
    P5 = 17,
    P6 = 12,
    P7 = 11,
    P8 = 18,
    P9 = 10,
    P10 = 6,
    P11 = 26,
    P12 = 20,
    P13 = 23,
    P14 = 22,
    P15 = 21,
    P16 = 16,
    P19 = 0,
    P20 = 30,
}

//% color="#FFA500" weight=10 icon="\uf2c9" block="Sensor:bit"
namespace Communication {
    
    /**
     * 红外发射
     */
    export enum encodingType {
        //% block="NEC"
        NEC
    }
    let tempHandler: Action;
    let irLed = AnalogPin.P16;
    const pwmPeriod = 26;
    pins.analogWritePin(irLed, 0);
    pins.analogSetPeriod(irLed, pwmPeriod);
    let send_init = false;
    let rec_init = false;
    let arr: number[] = []
    let received = false
    let first = true
    let rec_Type = ""
    let messageStr = ""
    let recPin = DigitalPin.P8
    let thereIsHandler = false
    arr = []

    function transmitBit(highTime: number, lowTime: number): void {
        pins.analogWritePin(irLed, 512);
        control.waitMicros(highTime);
        pins.analogWritePin(irLed, 0);
        control.waitMicros(lowTime);
    }

    //% blockId=setIR_pin block="set IR LED pin: %myPin" blockExternalInputs=false  group="红外发射"
    //% weight=90 blockGap=10
    //% myPin.fieldEditor="gridpicker" myPin.fieldOptions.columns=4
    //% myPin.fieldOptions.tooltips="false" myPin.fieldOptions.width="300"
    //% subcategory="执行器"
    export function setIR_pin(myPin: AnalogPin) {
        irLed = myPin;
        pins.analogWritePin(irLed, 0);
        pins.analogSetPeriod(irLed, pwmPeriod);
        send_init = true;
    }

    //% blockId=setREC_pin block="set IR receiver pin: %myPin" blockExternalInputs=false  group="红外接收"
    //% weight=85 blockGap=10
    //% myPin.fieldEditor="gridpicker" myPin.fieldOptions.columns=4
    //% myPin.fieldOptions.tooltips="false" myPin.fieldOptions.width="300"
    //% subcategory="执行器"
    export function setREC_pin(myPin: DigitalPin) {
        recPin = myPin;
        pins.setEvents(recPin, PinEventType.Pulse)
        pins.setPull(recPin, PinPullMode.PullUp)
        pins.onPulsed(recPin, PulseValue.Low, function () {
            arr.push(input.runningTimeMicros())
        })
        pins.onPulsed(recPin, PulseValue.High, function () {
            arr.push(input.runningTimeMicros())
        })
        control.onEvent(recPin, DAL.MICROBIT_PIN_EVENT_ON_TOUCH, tempHandler);
        rec_init = true;
    }

    //% blockId=sendMyMessage1 block="send message: %msg| ,%times| times, encoding type:%myType"  group="红外发射"
    //% weight=80 blockGap=10
    //% subcategory="执行器"
    export function sendMyMessage1(msg: string, times: number, myType: encodingType): void {
        if (send_init) {
            //control.inBackground(() => {
            sendMessage(convertHexStrToNum(msg), times, myType);
            //})
        }
    }

    /**
  * send message from IR LED. You must set the message encoding type, send how many times, and the message.
  */
    //% blockId=sendMyMessage2 block="send message: %msg| ,%times| times, encoding type:%myType"  group="红外发射"
    //% weight=75 blockGap=10
    //% subcategory="执行器"
    export function sendMyMessage2(msg: string, times: number, myType: string): void {
        if (send_init) {
            if (myType == "NEC") {
                sendMessage(convertHexStrToNum(msg), times, encodingType.NEC);
            }
        }
    }

    function encode(myCode: number, bits: number, trueHigh: number, trueLow: number, falseHigh: number, falseLow: number): void {
        const MESSAGE_BITS = bits;
        for (let mask = 1 << (MESSAGE_BITS - 1); mask > 0; mask >>= 1) {
            if (myCode & mask) {
                transmitBit(trueHigh, trueLow);
            } else {
                transmitBit(falseHigh, falseLow);
            }
        }
    }

    function sendNEC(message: number, times: number): void {
        const enum NEC {
            startHigh = 9000,
            startLow = 4500,
            stopHigh = 560,
            stopLow = 0,
            trueHigh = 560,
            trueLow = 1690,
            falseHigh = 560,
            falseLow = 560,
            interval = 110000
        }
        let address = message >> 16;
        let command = message % 0x010000;
        const MESSAGE_BITS = 16;
        let startTime = 0;
        let betweenTime = 0;
        for (let sendCount = 0; sendCount < times; sendCount++) {
            startTime = input.runningTimeMicros();
            transmitBit(NEC.startHigh, NEC.startLow);
            encode(address, 16, NEC.trueHigh, NEC.trueLow, NEC.falseHigh, NEC.falseLow);
            encode(command, 16, NEC.trueHigh, NEC.trueLow, NEC.falseHigh, NEC.falseLow);
            transmitBit(NEC.stopHigh, NEC.stopLow);
            betweenTime = input.runningTimeMicros() - startTime
            if (times > 0)
                control.waitMicros(NEC.interval - betweenTime);
        }
    }

    export function sendMessage(message: number, times: number, myType: encodingType): void {
        switch (myType) {
            case encodingType.NEC: sendNEC(message, times);
            default: sendNEC(message, times);
        }
    }

    function convertHexStrToNum(myMsg: string): number {
        let myNum = 0
        for (let i = 0; i < myMsg.length; i++) {
            if ((myMsg.charCodeAt(i) > 47) && (myMsg.charCodeAt(i) < 58)) {
                myNum += (myMsg.charCodeAt(i) - 48) * (16 ** (myMsg.length - 1 - i))
            } else if ((myMsg.charCodeAt(i) > 96) && (myMsg.charCodeAt(i) < 103)) {
                myNum += (myMsg.charCodeAt(i) - 87) * (16 ** (myMsg.length - 1 - i))
            } else if ((myMsg.charCodeAt(i) > 64) && (myMsg.charCodeAt(i) < 71)) {
                myNum += (myMsg.charCodeAt(i) - 55) * (16 ** (myMsg.length - 1 - i))
            } else {
                myNum = 0
                break
            }
        }
        return myNum
    }

    function resetReceiver() {
        arr = []
        received = false
    }


    function decodeIR() {
        let addr = 0
        let command = 0
        messageStr = ""
        rec_Type = ""
        for (let i = 0; i <= arr.length - 1 - 1; i++) {
            arr[i] = arr[i + 1] - arr[i]
        }
        if (((arr[0] + arr[1]) > 13000) && ((arr[0] + arr[1]) < 14000)) {
            rec_Type = "NEC"
            arr.removeAt(1)
            arr.removeAt(0)
            addr = pulseToDigit(0, 15, 1600)
            command = pulseToDigit(16, 31, 1600)
            messageStr = convertNumToHexStr(addr, 4) + convertNumToHexStr(command, 4)
            arr = [];
            if (thereIsHandler) {
                tempHandler();
            }
        } else if (((arr[0] + arr[1]) > 2600) && ((arr[0] + arr[1]) < 3200)) {
            rec_Type = "SONY"
            arr.removeAt(1)
            arr.removeAt(0)
            command = pulseToDigit(0, 11, 1300)
            messageStr = convertNumToHexStr(command, 3)
            arr = [];
            if (thereIsHandler) {
                tempHandler();
            }
        }
        resetReceiver();
    }

    function pulseToDigit(beginBit: number, endBit: number, duration: number): number {
        let myNum = 0
        for (let i = beginBit; i <= endBit; i++) {
            myNum <<= 1
            if ((arr[i * 2] + arr[i * 2 + 1]) < duration) {
                myNum += 0
            } else {
                myNum += 1
            }
        }
        return myNum
    }

    function convertNumToHexStr(myNum: number, digits: number): string {
        let tempDiv = 0
        let tempMod = 0
        let myStr = ""
        tempDiv = myNum
        while (tempDiv > 0) {
            tempMod = tempDiv % 16
            if (tempMod > 9) {
                myStr = String.fromCharCode(tempMod - 10 + 97) + myStr
            } else {
                myStr = tempMod + myStr
            }
            tempDiv = Math.idiv(tempDiv, 16)
        }
        while (myStr.length != digits) {
            myStr = "0" + myStr
        }
        return myStr
    }

    //% blockId=onReceivedIR block="on IR message received" blockInlineInputs=true  group="红外接收"
    //% weight=70 blockGap=10
    //% subcategory="执行器"
    export function onReceivedIR(handler: Action): void {
        tempHandler = handler
        thereIsHandler = true
    }

    //% blockId=getRecType block="the received IR encoding type"  group="红外接收"
    //% weight=60 blockGap=10
    //% subcategory="执行器"
    export function getRecType(): string {
        return rec_Type
    }
    //% blockId=getMessage block="the received IR message"  group="红外接收"
    //% weight=60 blockGap=10
    //% subcategory="执行器"
    export function getMessage(): string {
        return messageStr
    }

    //% blockId=sensor_ir_received_left_event
    //% block="on |%btn| button pressed" shim=Sensors::onPressEvent group="红外接收"
    //% subcategory="执行器"
    export function sensor_ir_received_left_event(btn: RemoteButton, body: () => void): void {
        return;
    }

    //% blockId=sensor_ir_init 
    //% block="connect ir receiver to %pin" shim=Sensors::init group="红外接收"
    //% subcategory="执行器"
    export function sensor_ir_init(pin: IrPins): void {
        return;
    }



    //% blockId=circulation block="receipt signal"  group="红外接收"
    //% weight=69
    //% subcategory="执行器"
    export function circulation(): void {
        if ((!received) && (rec_init)) {
            if (arr.length > 20) {
                if ((input.runningTimeMicros() - arr[arr.length - 1]) > 120000) {
                    if (first) {
                        resetReceiver()
                        first = false
                    } else {
                        received = true
                        decodeIR();
                    }
                }
            }
        }
    }




}
