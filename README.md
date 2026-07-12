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
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
PRIVATE_KEY=YOUR_DEPLOYER_WALLET_PRIVATE_KEY
```

주의:

- `PRIVATE_KEY`는 배포 또는 운영용 지갑의 private key입니다.
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

### Base Sepolia 배포(미사용)

```bash
npm run deploy:base-sepolia
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