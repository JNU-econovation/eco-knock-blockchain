# eco-knock-blockchain

Keyring 팀의 리워드 기능을 구현하기 위한 컨트랙트 저장소입니다.

동아리방 재실 시간에 따라 지급되는 KRT ERC-20 토큰과 중앙 서버가 계산한 일일 보상 내역을 사용자 지갑으로 분배하는 컨트랙트를 관리합니다.

## 주요 구성

### KeyringToken

`KeyringToken`은 Keyring 리워드에 사용되는 ERC-20 토큰입니다.

- Name: `Keyring Token`
- Symbol: `KRT`
- Initial Supply: `20,000,000 KRT`
- Max Supply: `50,000,000 KRT`
- 초기 발행량은 배포자에게 발행됩니다.
- `컨트랙트 배포자`는 최대 발행량을 넘지 않는 범위에서 추가 mint를 수행할 수 있습니다.

### RewardDistributor

`RewardDistributor`는 KRT 리워드 풀을 보관하고, 중앙 서버가 계산한 보상 내역을 사용자 지갑으로 전송합니다.

- `operator` 주소만이 보상 지급을 실행할 수 있습니다.
- 동일한 정산 배치의 중복 지급을 방지합니다.
- 일일 최대 `3,000 KRT`까지만 지급할 수 있습니다.
- 보상 지급은 추가 mint가 아닌, `RewardDistributor`가 보유한 KRT를 전송하는 방식으로 수행됩니다.

## 보상 지급 흐름

1. `KeyringToken`을 배포합니다.
2. `KeyringToken` 생성자에서 `20,000,000 KRT`가 배포자에게 발행됩니다.
3. `RewardDistributor`를 배포합니다.
4. 배포 모듈이 초기 발행량 전체를 `RewardDistributor`로 전송합니다.
5. 중앙 서버는 일일 재실 시간 데이터를 기준으로 `recipients`와 `amounts`를 계산합니다.
6. 중앙 서버 운영 지갑이 `RewardDistributor.distributeRewards(...)`를 호출합니다.
7. `RewardDistributor`는 보상 풀에서 사용자 지갑으로 KRT를 전송합니다.

## 개발 환경

```bash
npm install
```

## 환경 변수

`.env` 파일은 저장소 루트에 생성합니다.

```env
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY
PRIVATE_KEY=YOUR_DEPLOYER_WALLET_PRIVATE_KEY
SEPOLIA_REWARD_DISTRIBUTOR_ADDRESS=YOUR_SEPOLIA_REWARD_DISTRIBUTOR_ADDRESS

REWARD_BATCH_ID=manual-test:YYYY-MM-DD:n
REWARD_DAY=YYYYMMDD
REWARD_RECIPIENTS=0xRECIPIENT_ADDRESS_1,0xRECIPIENT_ADDRESS_2
REWARD_AMOUNTS=5,3
```

주의:

- 보상 지급 시 `PRIVATE_KEY`에 해당하는 지갑은 `RewardDistributor`의 `operator`와 일치해야 합니다.
- `SEPOLIA_REWARD_DISTRIBUTOR_ADDRESS`는 Ethereum Sepolia에 배포된 `RewardDistributor` 주소입니다.
- `REWARD_BATCH_ID`, `REWARD_DAY`, `REWARD_RECIPIENTS`, `REWARD_AMOUNTS`는 수동 지급 검증 스크립트의 입력값입니다.
- 테스트넷 배포에는 테스트넷 ETH가 필요합니다.

## 명령어

### 컴파일

```bash
npm run compile
```

### 테스트

```bash
npm test
```

### Ethereum Sepolia 배포

```bash
npm run deploy:sepolia
```

### Ethereum Sepolia 보상 지급 검증

```bash
npm run distribute:sepolia
```

### Base Sepolia 배포(미사용)

```bash
npm run deploy:base-sepolia
```

## 보상 지급 검증

`scripts/distributeRewards.js`는 중앙 서버 연동 전에 `RewardDistributor.distributeRewards(...)` 호출을 수동으로 검증하기 위한 스크립트입니다.

스크립트는 다음 작업을 수행합니다.

1. 지급 요청 환경 변수와 지갑 주소를 검증합니다.
2. 실행 지갑이 `RewardDistributor`의 `operator`인지 확인합니다.
3. `REWARD_BATCH_ID` 문자열을 `bytes32` 해시로 변환합니다.
4. 지급 트랜잭션을 시뮬레이션합니다.
5. 트랜잭션을 전송하고 블록에 포함될 때까지 기다립니다.

여러 사용자에게 지급할 때는 `REWARD_RECIPIENTS`와 `REWARD_AMOUNTS`를 동일한 순서와 개수로 작성합니다.

```env
REWARD_RECIPIENTS=0xRECIPIENT_ADDRESS_1,0xRECIPIENT_ADDRESS_2
REWARD_AMOUNTS=5,3
```

동일한 `REWARD_BATCH_ID`는 중복 지급 방지를 위해 다시 사용할 수 없습니다. 재실행이 필요한 새로운 지급 요청이라면 `manual-test:2026-07-13:2`와 같이 고유한 값을 사용합니다.

### Etherscan에서 지급 결과 확인

스크립트 실행 결과 중 `Transaction submitted:` 뒤에 출력되는 값이 트랜잭션 해시입니다.

```text
Transaction submitted: 0xTRANSACTION_HASH
```

다음 URL의 `{TRANSACTION_HASH}` 부분에 `Transaction submitted:` 뒤에 출력된 `0x`로 시작하는 트랜잭션 해시를 넣으면 지급 내역을 조회할 수 있습니다.

```text
https://sepolia.etherscan.io/tx/{TRANSACTION_HASH}
```

트랜잭션 상세 화면에서는 다음 항목을 확인합니다.

- `Status`가 `Success`인지 확인합니다.
- `From`이 트랜잭션에 서명한 operator 지갑인지 확인합니다.
- `To`가 `RewardDistributor` 컨트랙트인지 확인합니다.
- `ERC-20 Tokens Transferred`에서 수령 지갑과 지급된 KRT 수량을 확인합니다.

스크립트 출력의 `Batch` 괄호 안에 표시되는 값은 중복 지급 방지에 사용하는 `batchId` 해시이며, Etherscan 트랜잭션 조회에 사용하는 값이 아닙니다.

```text
Batch: manual-test:2026-07-13:1 (0xBATCH_ID)
```

특정 지갑의 KRT 보유량은 다음 URL로 조회할 수 있습니다.

```text
https://sepolia.etherscan.io/token/{KRT_TOKEN_ADDRESS}?a={WALLET_ADDRESS}
```

현재 Ethereum Sepolia의 KRT 컨트랙트 주소는 `0x052ce2e1310aDF7E2A42B6F87bA2F1d64fE92f30`입니다.

블록 번호는 `Reward distribution confirmed in block ...` 출력에서 확인할 수 있으며, 다음 URL로 해당 블록을 조회할 수 있습니다.

```text
https://sepolia.etherscan.io/block/{BLOCK_NUMBER}
```

## 배포 모듈

배포는 Hardhat Ignition을 사용합니다.

```text
ignition/modules/RewardDistributor.js
```

이 모듈은 다음 작업을 순서대로 수행합니다.

1. `KeyringToken` 배포
2. `RewardDistributor` 배포
3. `KeyringToken.INITIAL_SUPPLY()` 조회
4. 초기 발행량 전체를 `RewardDistributor`로 전송

기본 `operator`는 배포자 계정입니다.
별도 operator를 지정하려면 Ignition parameters 파일을 사용합니다.

```json
{
  "RewardDistributorModule": {
    "operator": "0xYOUR_OPERATOR_ADDRESS"
  }
}
```

## 테스트넷 배포 주소

### Ethereum Sepolia

- KeyringToken: `0x052ce2e1310aDF7E2A42B6F87bA2F1d64fE92f30`
- RewardDistributor: `0x1398E75da0a95F2a6C65a1dFb002d8c3af3Db23d`

Explorer:

- https://sepolia.etherscan.io/address/0x052ce2e1310aDF7E2A42B6F87bA2F1d64fE92f30
- https://sepolia.etherscan.io/address/0x1398E75da0a95F2a6C65a1dFb002d8c3af3Db23d

보상 지급 검증:

- 지급 트랜잭션 확인: `https://sepolia.etherscan.io/tx/{Transaction submitted 뒤에 출력된 해시값}`

## 중앙 서버 연동 시 필요한 값

중앙 서버는 배포된 컨트랙트 주소를 환경 변수로 관리합니다.

```env
KRT_TOKEN_ADDRESS=0x052ce2e1310aDF7E2A42B6F87bA2F1d64fE92f30
REWARD_DISTRIBUTOR_ADDRESS=0x1398E75da0a95F2a6C65a1dFb002d8c3af3Db23d
```

중앙 서버는 `operator` private key로 트랜잭션에 서명하여 `RewardDistributor.distributeRewards(...)`를 호출합니다.

## 향후 작업

- 중앙 서버와 보상 지급 플로우 연동
- 사용자 지갑 생성 및 주소 매핑 구조 설계
- 메인넷 배포 전 보안 검토
- 컨트랙트 배포 주소 및 운영 환경 설정 정리
